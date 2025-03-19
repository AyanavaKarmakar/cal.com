import { prisma } from "@calcom/prisma";
import type { TrpcSessionUser } from "@calcom/trpc/server/trpc";

import { TRPCError } from "@trpc/server";

import type { TDeleteFilterSegmentInputSchema } from "./delete.schema";

export const deleteHandler = async ({
  ctx,
  input,
}: {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
  input: TDeleteFilterSegmentInputSchema;
}) => {
  const { id } = input;
  const userId = ctx.user.id;

  const segment = await prisma.filterSegment.findFirst({
    where: {
      id,
    },
    select: {
      scope: true,
      teamId: true,
    },
  });
  if (!segment) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Filter segment not found or you don't have permission to delete it",
    });
  }

  const { scope, teamId } = segment;

  // First, fetch the existing segment to check permissions
  const existingSegment = await prisma.filterSegment.findFirst({
    where: {
      id,
      ...(scope === "TEAM"
        ? {
            scope: "TEAM",
            teamId,
            team: {
              members: {
                some: {
                  userId,
                  accepted: true,
                  role: {
                    in: ["ADMIN", "OWNER"],
                  },
                },
              },
            },
          }
        : {
            scope: "USER",
            userId,
          }),
    },
    select: {
      id: true,
    },
  });

  if (!existingSegment) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be a team admin or owner to delete team filter segments",
    });
  }

  // Delete the filter segment
  await prisma.filterSegment.delete({
    where: { id },
  });

  return {
    id,
    message: "Filter segment deleted successfully",
  };
};
