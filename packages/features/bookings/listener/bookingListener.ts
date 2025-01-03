import type { DestinationCalendar } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import type { TFunction } from "next-i18next";
import type { z } from "zod";

import { metadata as GoogleMeetMetadata } from "@calcom/app-store/googlevideo/_metadata";
import { MeetLocationType } from "@calcom/app-store/locations";
import EventManager from "@calcom/core/EventManager";
import type { EventNameObjectType } from "@calcom/core/event";
import monitorCallbackAsync from "@calcom/core/sentryWrapper";
import dayjs from "@calcom/dayjs";
import { sendScheduledEmailsAndSMS } from "@calcom/emails";
import type { getAllCredentials } from "@calcom/features/bookings/lib/getAllCredentialsForUsersOnEvent/getAllCredentials";
import { refreshCredentials } from "@calcom/features/bookings/lib/getAllCredentialsForUsersOnEvent/refreshCredentials";
import { handleAppsStatus } from "@calcom/features/bookings/lib/handleNewBooking/handleAppsStatus";
import { handleWebhookTrigger } from "@calcom/features/bookings/lib/handleWebhookTrigger";
import {
  allowDisablingAttendeeConfirmationEmails,
  allowDisablingHostConfirmationEmails,
} from "@calcom/features/ee/workflows/lib/allowDisablingStandardEmails";
import getWebhooks from "@calcom/features/webhooks/lib/getWebhooks";
import type { GetSubscriberOptions } from "@calcom/features/webhooks/lib/getWebhooks";
import { scheduleTrigger } from "@calcom/features/webhooks/lib/scheduleTrigger";
import type { EventTypeInfo, EventPayloadType } from "@calcom/features/webhooks/lib/sendPayload";
import { getVideoCallUrlFromCalEvent } from "@calcom/lib/CalEventParser";
import getOrgIdFromMemberOrTeamId from "@calcom/lib/getOrgIdFromMemberOrTeamId";
import logger from "@calcom/lib/logger";
import { getPiiFreeCalendarEvent } from "@calcom/lib/piiFreeData";
import { safeStringify } from "@calcom/lib/safeStringify";
import prisma from "@calcom/prisma";
import { WebhookTriggerEvents } from "@calcom/prisma/enums";
import { EventTypeMetaDataSchema, bookingMetadataSchema } from "@calcom/prisma/zod-utils";
import { getAllWorkflowsFromEventType } from "@calcom/trpc/server/routers/viewer/workflows/util";
import type { CalendarEvent, AdditionalInformation, AppsStatus } from "@calcom/types/Calendar";

class BookingListener {
  static async create({
    evt,
    allCredentials,
    organizerUser,
    eventType,
    tOrganizer,
    booking,
    eventNameObject,
    teamId,
    platformClientId,
  }: {
    evt: CalendarEvent;
    allCredentials: Awaited<ReturnType<typeof getAllCredentials>>;
    organizerUser: {
      id: number;
      email: string;
      destinationCalendar: DestinationCalendar | null;
      username: string | null;
    };
    eventType: {
      id: number;
      title: string;
      description: string | null;
      teamId?: number | null;
      parentId?: number | null;
      parent?: { id: number; teamId: number | null } | null;
      metadata: z.infer<typeof EventTypeMetaDataSchema> | Prisma.JsonValue | null;
    };
    tOrganizer: TFunction;
    booking: {
      id: number;
      startTime: Date;
      endTime: Date;
      location?: string | null;
      appsStatus?: AppsStatus[];
      iCalUID: string | null;
      description: string | null;
      customInputs: Prisma.JsonValue | null;
      metadata: Prisma.JsonValue | null;
    };
    eventNameObject: EventNameObjectType;
    teamId?: number | null;
    platformClientId?: string;
  }) {
    const log = logger.getSubLogger({ prefix: ["[BookingListener.create]"] });
    const eventTypeMetadata = EventTypeMetaDataSchema.parse(eventType?.metadata || {});

    // Handle apps & creating booking references
    const credentials = await monitorCallbackAsync(refreshCredentials, allCredentials);

    const eventManager = new EventManager({ ...organizerUser, credentials }, eventTypeMetadata?.apps ?? {});

    const { results, referencesToCreate } = await eventManager.create(evt);

    // TODO check if this is needed
    // if (evt.location) {
    //     booking.location = evt.location;
    // }

    // TODO check if this is needed
    // This gets overridden when creating the event - to check if notes have been hidden or not. We just reset this back
    // to the default description when we are sending the emails.
    // evt.description = eventType.description;

    let videoCallUrl = evt.videoCallData && evt.videoCallData.url ? evt.videoCallData.url : null;

    if (results.length > 0 && results.every((res) => !res.success)) {
      const error = {
        errorCode: "BookingCreatingMeetingFailed",
        message: "Booking failed",
      };

      log.error(
        `EventManager.create failure in some of the integrations ${organizerUser.username}`,
        safeStringify({ error, results })
      );
    }
    const additionalInformation: AdditionalInformation = {};

    if (results.length) {
      // Handle Google Meet results
      // We use the original booking location since the evt location changes to daily
      if (evt.location === MeetLocationType) {
        const googleMeetResult = {
          appName: GoogleMeetMetadata.name,
          type: "conferencing",
          uid: results[0].uid,
          originalEvent: results[0].originalEvent,
        };

        // Find index of google_calendar inside createManager.referencesToCreate
        const googleCalIndex = referencesToCreate.findIndex((ref) => ref.type === "google_calendar");
        const googleCalResult = results[googleCalIndex];

        if (!googleCalResult) {
          log.warn("Google Calendar not installed but using Google Meet as location");
          results.push({
            ...googleMeetResult,
            success: false,
            calWarnings: [tOrganizer("google_meet_warning")],
          });
        }

        if (googleCalResult?.createdEvent?.hangoutLink) {
          results.push({
            ...googleMeetResult,
            success: true,
          });

          // Add google_meet to referencesToCreate in the same index as google_calendar
          referencesToCreate[googleCalIndex] = {
            ...referencesToCreate[googleCalIndex],
            meetingUrl: googleCalResult.createdEvent.hangoutLink,
          };

          // Also create a new referenceToCreate with type video for google_meet
          referencesToCreate.push({
            type: "google_meet_video",
            meetingUrl: googleCalResult.createdEvent.hangoutLink,
            uid: googleCalResult.uid,
            credentialId: referencesToCreate[googleCalIndex].credentialId,
          });
        } else if (googleCalResult && !googleCalResult.createdEvent?.hangoutLink) {
          results.push({
            ...googleMeetResult,
            success: false,
          });
        }
      }
      // TODO: Handle created event metadata more elegantly
      additionalInformation.hangoutLink = results[0].createdEvent?.hangoutLink;
      additionalInformation.conferenceData = results[0].createdEvent?.conferenceData;
      additionalInformation.entryPoints = results[0].createdEvent?.entryPoints;
      evt.appsStatus = handleAppsStatus(results, booking);
      videoCallUrl = additionalInformation.hangoutLink || evt.location || videoCallUrl;

      if (evt.iCalUID !== booking.iCalUID) {
        // The eventManager could change the iCalUID. At this point we can update the DB record
        await prisma.booking.update({
          where: {
            id: booking.id,
          },
          data: {
            iCalUID: evt.iCalUID || booking.iCalUID,
          },
        });
      }
    }

    const bookingMetadata = bookingMetadataSchema.parse(booking?.metadata || {});

    const workflows = await getAllWorkflowsFromEventType(
      {
        ...eventType,
        metadata: eventType.metadata as Prisma.JsonValue,
      },
      organizerUser.id
    );

    if (bookingMetadata?.noEmail !== true) {
      let isHostConfirmationEmailsDisabled = false;
      let isAttendeeConfirmationEmailDisabled = false;

      isHostConfirmationEmailsDisabled =
        eventTypeMetadata?.disableStandardEmails?.confirmation?.host || false;
      isAttendeeConfirmationEmailDisabled =
        eventTypeMetadata?.disableStandardEmails?.confirmation?.attendee || false;

      if (isHostConfirmationEmailsDisabled) {
        isHostConfirmationEmailsDisabled = allowDisablingHostConfirmationEmails(workflows);
      }

      if (isAttendeeConfirmationEmailDisabled) {
        isAttendeeConfirmationEmailDisabled = allowDisablingAttendeeConfirmationEmails(workflows);
      }

      log.debug(
        "Emails: Sending scheduled emails for booking confirmation",
        safeStringify({
          calEvent: getPiiFreeCalendarEvent(evt),
        })
      );

      await monitorCallbackAsync(
        sendScheduledEmailsAndSMS,
        {
          ...evt,
          additionalInformation,
          additionalNotes: booking.description,
          customInputs: booking.customInputs as Prisma.JsonObject,
        },
        eventNameObject,
        isHostConfirmationEmailsDisabled,
        isAttendeeConfirmationEmailDisabled,
        eventTypeMetadata
      );
    }

    const triggerForUser = !teamId || (teamId && eventType.parentId);
    const organizerUserId = triggerForUser ? organizerUser.id : null;
    const orgId = await getOrgIdFromMemberOrTeamId({ memberId: organizerUserId, teamId });

    const subscriberOptionsMeetingEnded = {
      userId: triggerForUser ? organizerUser.id : null,
      eventTypeId: eventType.id,
      triggerEvent: WebhookTriggerEvents.MEETING_ENDED,
      teamId,
      orgId,
      oAuthClientId: platformClientId,
    };

    const subscriberOptionsMeetingStarted = {
      userId: triggerForUser ? organizerUser.id : null,
      eventTypeId: eventType.id,
      triggerEvent: WebhookTriggerEvents.MEETING_STARTED,
      teamId,
      orgId,
      oAuthClientId: platformClientId,
    };

    const subscribersMeetingEnded = await monitorCallbackAsync(getWebhooks, subscriberOptionsMeetingEnded);
    const subscribersMeetingStarted = await monitorCallbackAsync(
      getWebhooks,
      subscriberOptionsMeetingStarted
    );

    const deleteWebhookScheduledTriggerPromise: Promise<unknown> = Promise.resolve();
    const scheduleTriggerPromises = [];

    for (const subscriber of subscribersMeetingEnded) {
      scheduleTriggerPromises.push(
        scheduleTrigger({
          booking,
          subscriberUrl: subscriber.subscriberUrl,
          subscriber,
          triggerEvent: WebhookTriggerEvents.MEETING_ENDED,
        })
      );
    }

    for (const subscriber of subscribersMeetingStarted) {
      scheduleTriggerPromises.push(
        scheduleTrigger({
          booking,
          subscriberUrl: subscriber.subscriberUrl,
          subscriber,
          triggerEvent: WebhookTriggerEvents.MEETING_STARTED,
        })
      );
    }

    await Promise.all([deleteWebhookScheduledTriggerPromise, ...scheduleTriggerPromises]).catch((error) => {
      log.error("Error while scheduling or canceling webhook triggers", JSON.stringify({ error }));
    });

    const subscriberOptions: GetSubscriberOptions = {
      userId: organizerUserId,
      eventTypeId: eventType.id,
      triggerEvent: WebhookTriggerEvents.BOOKING_CREATED,
      teamId,
      orgId,
      oAuthClientId: platformClientId,
    };

    const eventTypeInfo: EventTypeInfo = {
      eventTitle: eventType.title,
      eventDescription: eventType.description,
      length: dayjs(evt.endTime).diff(dayjs(evt.startTime), "minutes"),
    };

    if (booking.location?.startsWith("http")) {
      videoCallUrl = booking.location;
    }

    const metadata = videoCallUrl
      ? {
          videoCallUrl: getVideoCallUrlFromCalEvent(evt) || videoCallUrl,
        }
      : undefined;

    const webhookData: EventPayloadType = {
      ...evt,
      ...eventTypeInfo,
      bookingId: booking.id,
      metadata: { ...bookingMetadata, ...metadata },
    };

    // Send Webhook call if hooked to BOOKING_CREATED & BOOKING_RESCHEDULED
    await monitorCallbackAsync(handleWebhookTrigger, {
      subscriberOptions,
      eventTrigger: WebhookTriggerEvents.BOOKING_CREATED,
      webhookData,
    });
    // TODO - Apps :done:
    // TODO - Emails :done:
    // TODO - workflows
    // TODO - webhooks :done:
    // TODO - update booking metadata
  }
}

export default BookingListener;
