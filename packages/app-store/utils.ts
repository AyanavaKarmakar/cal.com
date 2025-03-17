import type { AppCategories } from "@prisma/client";
import type { z } from "zod";

// If you import this file on any app it should produce circular dependency
// import appStore from "./index";
import type { EventLocationType } from "@calcom/app-store/locations";
import type { BookerEvent } from "@calcom/features/bookings/types";
import type { eventTypeMetaDataSchemaWithTypedApps } from "@calcom/prisma/zod-utils";

export type EventTypeApps = NonNullable<
  NonNullable<z.infer<typeof eventTypeMetaDataSchemaWithTypedApps>>["apps"]
>;
export type EventTypeAppsList = keyof EventTypeApps;

export const getEventTypeAppData = <T extends EventTypeAppsList>(
  eventType: Pick<BookerEvent, "price" | "currency" | "metadata">,
  appId: T,
  forcedGet?: boolean
): EventTypeApps[T] => {
  const metadata = eventType.metadata;
  const appMetadata = metadata?.apps && metadata.apps[appId];
  if (appMetadata) {
    const allowDataGet = forcedGet ? true : appMetadata.enabled;
    return allowDataGet
      ? {
          ...appMetadata,
          // We should favor eventType's price and currency over appMetadata's price and currency
          price: eventType.price || appMetadata.price || null,
          currency: eventType.currency || appMetadata.currency || null,
          // trackingId is legacy way to store value for TRACKING_ID. So, we need to support both.
          TRACKING_ID: appMetadata.TRACKING_ID || appMetadata.trackingId || null,
        }
      : null;
  }
  // Backward compatibility for existing event types.
  // TODO: After the new AppStore EventType App flow is stable, write a migration to migrate metadata to new format which will let us remove this compatibility code
  // Migration isn't being done right now, to allow a revert if needed
  const legacyAppsData = {
    stripe: {
      enabled: !!eventType.price,
      // Price default is 0 in DB. So, it would always be non nullish.
      price: eventType.price,
      // Currency default is "usd" in DB.So, it would also be available always
      currency: eventType.currency,
      paymentOption: "ON_BOOKING",
    },
    giphy: {
      enabled: !!eventType.metadata?.giphyThankYouPage,
      thankYouPage: eventType.metadata?.giphyThankYouPage || "",
    },
  } as const;

  // TODO: This assertion helps typescript hint that only one of the app's data can be returned
  const legacyAppData = legacyAppsData[appId as Extract<T, keyof typeof legacyAppsData>];
  const allowDataGet = forcedGet ? true : legacyAppData?.enabled;
  return allowDataGet ? legacyAppData : null;
};

export type LocationOption = {
  label: string;
  value: EventLocationType["type"];
  icon?: string;
  disabled?: boolean;
};

/**
 *
 * @param appCategories - from app metadata
 * @param concurrentMeetings - from app metadata
 * @returns - true if app supports team install
 */
export function doesAppSupportTeamInstall({
  appCategories,
  concurrentMeetings = undefined,
  isPaid,
}: {
  appCategories: string[];
  concurrentMeetings: boolean | undefined;
  isPaid: boolean;
}) {
  // Paid apps can't be installed on team level - That isn't supported
  if (isPaid) {
    return false;
  }
  return !appCategories.some(
    (category) =>
      category === "calendar" ||
      (defaultVideoAppCategories.includes(category as AppCategories) && !concurrentMeetings)
  );
}

export function isConferencing(appCategories: string[]) {
  return appCategories.some((category) => category === "conferencing" || category === "video");
}

export const defaultVideoAppCategories: AppCategories[] = [
  "messaging",
  "conferencing",
  // Legacy name for conferencing
  "video",
];
