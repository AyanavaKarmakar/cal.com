import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import type { Host, TeamMember } from "@calcom/features/eventtypes/lib/types";
import type { AttributesQueryValue } from "@calcom/lib/raqb/types";
import { SUCCESS_STATUS } from "@calcom/platform-constants";
import type { ApiResponse, ApiSuccessResponse } from "@calcom/platform-types";
import { trpc } from "@calcom/trpc/react";

import { useAtomsContext } from "../../hooks/useAtomsContext";
import http from "../../lib/http";

type TeamMembersAttributesReturnType = {
  result: Array<{
    id: number;
    name: string | null;
    email: string;
  }>;
};

interface UseTeamMembersWithSegmentProps {
  initialTeamMembers: TeamMember[];
  assignRRMembersUsingSegment: boolean;
  teamId?: number;
  orgId?: number;
  queryValue?: AttributesQueryValue | null;
  value: Host[];
}

export const useTeamMembersWithSegmentPlatform = ({
  initialTeamMembers,
  assignRRMembersUsingSegment,
  teamId,
  orgId,
  queryValue,
  value,
}: UseTeamMembersWithSegmentProps) => {
  const { isInit } = useAtomsContext();

  const pathname = `/atoms/organizations/${orgId}/teams/${teamId}/members-matching-attribute?${new URLSearchParams(
    {
      attributesQueryValue: queryValue ? JSON.stringify(queryValue) : "",
      enablePerf: "true",
    }
  )}`;

  const { data: matchingTeamMembersWithResult, isPending } = useQuery({
    queryKey: ["teamMembersMatchingAttribute", teamId, orgId, queryValue],
    queryFn: async () => {
      return http?.get<ApiResponse<TeamMembersAttributesReturnType>>(pathname).then((res) => {
        if (res.data.status === SUCCESS_STATUS) {
          return (res.data as ApiSuccessResponse<TeamMembersAttributesReturnType>).data;
        }
        throw new Error(res.data.error.message);
      });
    },
    enabled: isInit && !!teamId && !!orgId,
  });

  const teamMembers = useMemo(() => {
    if (assignRRMembersUsingSegment && matchingTeamMembersWithResult?.result) {
      return matchingTeamMembersWithResult.result.map((member) => ({
        value: member.id.toString(),
        label: member.name || member.email,
        email: member.email,
        avatar: "",
      }));
    }
    return initialTeamMembers;
  }, [assignRRMembersUsingSegment, matchingTeamMembersWithResult, initialTeamMembers]);

  const localWeightsInitialValues = useMemo(
    () =>
      teamMembers.reduce<Record<string, number>>((acc, member) => {
        const memberInValue = value.find((host) => host.userId === parseInt(member.value, 10));
        acc[member.value] = memberInValue?.weight ?? 100;
        return acc;
      }, {}),
    [teamMembers, value]
  );

  return {
    teamMembers,
    localWeightsInitialValues,
    isPending,
  };
};

export const useTeamMembersWithSegment = ({
  initialTeamMembers,
  assignRRMembersUsingSegment,
  teamId,
  queryValue,
  value,
}: UseTeamMembersWithSegmentProps) => {
  const { data: matchingTeamMembersWithResult, isPending } =
    trpc.viewer.attributes.findTeamMembersMatchingAttributeLogic.useQuery(
      {
        teamId: teamId || 0,
        attributesQueryValue: queryValue as AttributesQueryValue,
        _enablePerf: true,
      },
      {
        enabled: assignRRMembersUsingSegment && !!queryValue && !!teamId,
      }
    );

  const teamMembers = useMemo(() => {
    if (assignRRMembersUsingSegment && matchingTeamMembersWithResult?.result) {
      return matchingTeamMembersWithResult.result.map((member) => ({
        value: member.id.toString(),
        label: member.name || member.email,
        email: member.email,
        avatar: "", // Add avatar with fallback to empty string
      }));
    }
    return initialTeamMembers;
  }, [assignRRMembersUsingSegment, matchingTeamMembersWithResult, initialTeamMembers]);

  const localWeightsInitialValues = useMemo(
    () =>
      teamMembers.reduce<Record<string, number>>((acc, member) => {
        const memberInValue = value.find((host) => host.userId === parseInt(member.value, 10));
        acc[member.value] = memberInValue?.weight ?? 100;
        return acc;
      }, {}),
    [teamMembers, value]
  );

  return {
    teamMembers,
    localWeightsInitialValues,
    isPending,
  };
};
