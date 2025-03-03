import { InternalTeamBilling } from "@calcom/ee/billing/teams/internal-team-billing";
import { IS_SELF_HOSTED } from "@calcom/lib/constants";
import { prisma } from "@calcom/prisma";
import type { TrpcSessionUser } from "@calcom/trpc/server/trpc";

type HasActiveTeamPlanOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
};

export const hasActiveTeamPlanHandler = async ({ ctx }: HasActiveTeamPlanOptions) => {
  if (IS_SELF_HOSTED) return { isActive: true, isTrial: false };
  const teams = await prisma.team.findMany({
    where: {
      members: {
        some: {
          userId: ctx.user.id,
          accepted: true,
        },
      },
    },
  });

  if (!teams.length) return { isActive: false, isTrial: false };

  // check if user has at least on membership with an active plan
  for (const team of teams) {
    const teamBillingService = new InternalTeamBilling(team);
    const isPlanActive = await teamBillingService.checkIfTeamHasActivePlan();
    if (isPlanActive) {
      return { isActive: true, isTrial: false };
    }
  }

  return { isActive: false, isTrial: true };
};

export default hasActiveTeamPlanHandler;
