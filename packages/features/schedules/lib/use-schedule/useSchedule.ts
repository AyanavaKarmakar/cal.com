import dayjs from "@calcom/dayjs";
import { getUsernameList } from "@calcom/lib/defaultEvents";
import { trpc } from "@calcom/trpc/react";

type UseScheduleWithCacheArgs = {
  username?: string | null;
  eventSlug?: string | null;
  eventId?: number | null;
  month?: string | null;
  timezone?: string | null;
  prefetchNextMonth?: boolean;
  duration?: number | null;
  org: string | null;
  isTeamEvent: boolean;
};

export const useSchedule = ({
  month,
  timezone,
  username,
  eventSlug,
  prefetchNextMonth,
  duration,
  org,
  isTeamEvent,
}: UseScheduleWithCacheArgs) => {
  const monthDayjs = month ? dayjs(month) : dayjs();
  const nextMonthDayjs = monthDayjs.add(1, "month");
  // Why the non-null assertions? All of these arguments are checked in the enabled condition,
  // and the query will not run if they are null. However, the check in `enabled` does
  // no satisfy typscript.

  return trpc.viewer.public.slots.getSchedule.useQuery(
    {
      usernameList: getUsernameList(username ?? ""),
      eventTypeSlug: eventSlug!,
      // @TODO: Old code fetched 2 days ago if we were fetching the current month.
      // Do we want / need to keep that behavior?
      startTime: monthDayjs.startOf("month").toISOString(),
      // if `prefetchNextMonth` is true, two months are fetched at once.
      endTime: (prefetchNextMonth ? nextMonthDayjs : monthDayjs).endOf("month").toISOString(),
      timeZone: timezone!,
      duration: duration ? `${duration}` : undefined,
      org,
      isTeamEvent,
    },
    {
      refetchOnWindowFocus: false,
      enabled: Boolean(username) && Boolean(eventSlug) && Boolean(month) && Boolean(timezone),
    }
  );
};
