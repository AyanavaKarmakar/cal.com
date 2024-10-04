import logger from "@calcom/lib/logger";
import { safeStringify } from "@calcom/lib/safeStringify";
import prisma from "@calcom/prisma";
import type { Attribute } from "../types/types";

async function getAttributeToUserWithMembershipAndAttributesForTeam({ teamId }: { teamId: number }) {
  let log = logger.getSubLogger({ prefix: ["getAttributeToUserWithMembershipAndAttributes"] });

  const whereClauseForAttributesAssignedToMembersOfTeam = {
    member: {
      user: {
        teams: {
          some: {
            teamId,
          },
        },
      },
    },
  };

  log.debug(
    safeStringify({
      teamId,
      whereClauseForAttributesAssignedToMembersOfTeam,
    })
  );

  const attributesToUser = await prisma.attributeToUser.findMany({
    where: whereClauseForAttributesAssignedToMembersOfTeam,
    select: {
      member: {
        select: {
          userId: true,
        },
      },
      attributeOption: {
        select: {
          id: true,
          value: true,
          slug: true,
          attribute: {
            select: { id: true, name: true, type: true, slug: true },
          },
        },
      },
    },
  });

  log.debug("Returned attributesToUser", safeStringify({ attributesToUser }));
  return attributesToUser;
}

async function getAttributesAssignedToMembersOfTeam({ teamId }: { teamId: number }) {
  let log = logger.getSubLogger({ prefix: ["getAttributeToUserWithMembershipAndAttributes"] });

  const whereClauseForAttributesAssignedToMembersOfTeam =  {
    options: {
      some: {
        assignedUsers: {
          some: {
            member: {
              user: {
                teams: {
                  some: {
                    teamId,
                  },
                },
              },
            },
          },
        },
      },
    },
  }

  log.debug(
    safeStringify({
      teamId,
      whereClauseForAttributesAssignedToMembersOfTeam,
    })
  );

  const attributesToUser = await prisma.attribute.findMany({
    where: whereClauseForAttributesAssignedToMembersOfTeam,
    select: {
      id: true,
      name: true,
      type: true,
      options: true,
      slug: true,
    },
  });
  return attributesToUser;
}

export async function getAttributesForTeam({ teamId }: { teamId: number }) {
  const attributes = await getAttributesAssignedToMembersOfTeam({ teamId });
  return attributes satisfies Attribute[];
}

export async function getAttributesMappedWithTeamMembers({ teamId }: { teamId: number }) {
  const attributesToUser = await getAttributeToUserWithMembershipAndAttributesForTeam({ teamId });

  const teamMembers = attributesToUser.reduce((acc, attributeToUser) => {
    const { userId } = attributeToUser.member;
    const { attribute, slug } = attributeToUser.attributeOption;

    if (!acc[userId]) {
      acc[userId] = { userId, attributes: {} };
    }

    if (Array.isArray(acc[userId].attributes[attribute.id])) {
      acc[userId].attributes[attribute.id].push(slug);
    } else if (acc[userId].attributes[attribute.id]) {
      acc[userId].attributes[attribute.id] = [acc[userId].attributes[attribute.id], slug];
    } else {
      acc[userId].attributes[attribute.id] = slug;
    }
    return acc;
  }, {} as Record<number, { userId: number; attributes: Record<string, string> }>);

  return Object.values(teamMembers);
}
