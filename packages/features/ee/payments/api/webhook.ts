import type { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";

import stripe from "@calcom/app-store/stripepayment/lib/server";
import { sendAttendeeRequestEmailAndSMS, sendOrganizerRequestEmail } from "@calcom/emails";
import { doesBookingRequireConfirmation } from "@calcom/features/bookings/lib/doesBookingRequireConfirmation";
import { getAllCredentials } from "@calcom/features/bookings/lib/getAllCredentialsForUsersOnEvent/getAllCredentials";
import { handleConfirmation } from "@calcom/features/bookings/lib/handleConfirmation";
import EventManager from "@calcom/lib/EventManager";
import { IS_PRODUCTION } from "@calcom/lib/constants";
import { getErrorFromUnknown } from "@calcom/lib/errors";
import { HttpError as HttpCode } from "@calcom/lib/http-error";
import logger from "@calcom/lib/logger";
import { getBooking } from "@calcom/lib/payment/getBooking";
import { handlePaymentSuccess } from "@calcom/lib/payment/handlePaymentSuccess";
import { safeStringify } from "@calcom/lib/safeStringify";
import { prisma } from "@calcom/prisma";
import { BookingStatus } from "@calcom/prisma/enums";
import { eventTypeMetaDataSchemaWithTypedApps } from "@calcom/prisma/zod-utils";

const log = logger.getSubLogger({ prefix: ["[paymentWebhook]"] });

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function handleStripePaymentSuccess(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const payment = await prisma.payment.findFirst({
    where: {
      externalId: paymentIntent.id,
    },
    select: {
      id: true,
      bookingId: true,
    },
  });

  if (!payment?.bookingId) {
    log.error("Stripe: Payment Not Found", safeStringify(paymentIntent), safeStringify(payment));
    throw new HttpCode({ statusCode: 204, message: "Payment not found" });
  }
  if (!payment?.bookingId) throw new HttpCode({ statusCode: 204, message: "Payment not found" });

  await handlePaymentSuccess(payment.id, payment.bookingId);
}

const handleSetupSuccess = async (event: Stripe.Event) => {
  const setupIntent = event.data.object as Stripe.SetupIntent;
  const payment = await prisma.payment.findFirst({
    where: {
      externalId: setupIntent.id,
    },
  });

  if (!payment?.data || !payment?.id) throw new HttpCode({ statusCode: 204, message: "Payment not found" });

  const { booking, user, evt, eventType } = await getBooking(payment.bookingId);

  const bookingData: Prisma.BookingUpdateInput = {
    paid: true,
  };

  if (!user) throw new HttpCode({ statusCode: 204, message: "No user found" });

  const requiresConfirmation = doesBookingRequireConfirmation({
    booking: {
      ...booking,
      eventType,
    },
  });

  const metadata = eventTypeMetaDataSchemaWithTypedApps.parse(eventType?.metadata);
  const allCredentials = await getAllCredentials(user, {
    ...booking.eventType,
    metadata,
  });

  if (!requiresConfirmation) {
    const eventManager = new EventManager({ ...user, credentials: allCredentials }, metadata?.apps);
    const scheduleResult = await eventManager.create(evt);
    bookingData.references = { create: scheduleResult.referencesToCreate };
    bookingData.status = BookingStatus.ACCEPTED;
  }

  await prisma.payment.update({
    where: {
      id: payment.id,
    },
    data: {
      data: {
        ...(payment.data as Prisma.JsonObject),
        setupIntent: setupIntent as unknown as Prisma.JsonObject,
      },
      booking: {
        update: {
          ...bookingData,
        },
      },
    },
  });

  // If the card information was already captured in the same customer. Delete the previous payment method

  if (!requiresConfirmation) {
    await handleConfirmation({
      user: { ...user, credentials: allCredentials },
      evt,
      prisma,
      bookingId: booking.id,
      booking,
      paid: true,
    });
  } else {
    await sendOrganizerRequestEmail({ ...evt }, eventType.metadata);
    await sendAttendeeRequestEmailAndSMS({ ...evt }, evt.attendees[0], eventType.metadata);
  }
};

type WebhookHandler = (event: Stripe.Event) => Promise<void>;

const webhookHandlers: Record<string, WebhookHandler | undefined> = {
  "payment_intent.succeeded": handleStripePaymentSuccess,
  "setup_intent.succeeded": handleSetupSuccess,
};

/**
 * @deprecated
 * We need to create a PaymentManager in `@calcom/lib`
 * to prevent circular dependencies on App Store migration
 */
async function handler(req: NextRequest) {
  try {
    const sig = headers().get("stripe-signature");
    if (!sig) {
      throw new HttpCode({ statusCode: 400, message: "Missing stripe-signature" });
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      throw new HttpCode({ statusCode: 500, message: "Missing process.env.STRIPE_WEBHOOK_SECRET" });
    }
    const rawBody = await req.text();
    const requestBuffer = Buffer.from(rawBody);
    const payload = requestBuffer.toString();

    const event = stripe.webhooks.constructEvent(payload, sig, process.env.STRIPE_WEBHOOK_SECRET);

    // bypassing this validation for e2e tests
    // in order to successfully confirm the payment
    if (!event.account && !process.env.NEXT_PUBLIC_IS_E2E) {
      throw new HttpCode({ statusCode: 202, message: "Incoming connected account" });
    }

    const handler = webhookHandlers[event.type];
    if (handler) {
      await handler(event);
    } else {
      /** Not really an error, just letting Stripe know that the webhook was received but unhandled */
      throw new HttpCode({
        statusCode: 202,
        message: `Unhandled Stripe Webhook event type ${event.type}`,
      });
    }
  } catch (_err) {
    const err = getErrorFromUnknown(_err);
    console.error(`Webhook Error: ${err.message}`);
    return NextResponse.json(
      {
        message: err.message,
        stack: IS_PRODUCTION ? undefined : err.stack,
      },
      {
        status: err.statusCode ?? 500,
      }
    );
    return;
  }

  // Return a response to acknowledge receipt of the event
  return NextResponse.json(
    {
      received: true,
    },
    {
      status: 200,
    }
  );
}

export const POST = handler;
