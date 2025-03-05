import { useQuery } from "@tanstack/react-query";

import { SUCCESS_STATUS } from "@calcom/platform-constants";
import type { ApiResponse, ApiSuccessResponse } from "@calcom/platform-types";

import { useAtomsContext } from "../../../hooks/useAtomsContext";
import http from "../../../lib/http";

export const QUERY_KEY = "use-get-event-types";

type ResponseEventType = { eventTypes: Array<{ id: number; title: string }> };

export const useAtomGetEventTypes = (teamId?: number, organizationId?: number) => {
  const { isInit, accessToken } = useAtomsContext();

  let pathname = "/atoms/event-types";

  if (organizationId && teamId) {
    pathname = `/atoms/organizations/${organizationId}/teams/${teamId}/event-types`;
  }

  return useQuery({
    queryKey: [QUERY_KEY, teamId, organizationId],
    queryFn: () => {
      if (organizationId && !teamId) return;
      return http?.get<ApiResponse<ResponseEventType>>(pathname).then((res) => {
        if (res.data.status === SUCCESS_STATUS) {
          return (res.data as ApiSuccessResponse<ResponseEventType>).data;
        }
        throw new Error(res.data.error.message);
      });
    },
    enabled: isInit && !!accessToken,
  });
};
