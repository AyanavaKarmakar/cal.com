import { CreateOrgMembershipDto } from "@/modules/organizations/memberships/inputs/create-organization-membership.input";
import { PrismaReadService } from "@/modules/prisma/prisma-read.service";
import { PrismaWriteService } from "@/modules/prisma/prisma-write.service";
import { Injectable } from "@nestjs/common";

import { UpdateOrgMembershipDto } from "./inputs/update-organization-membership.input";

@Injectable()
export class OrganizationsMembershipRepository {
  constructor(private readonly dbRead: PrismaReadService, private readonly dbWrite: PrismaWriteService) {}

  async findOrgMembership(organizationId: number, membershipId: number) {
    return this.dbRead.prisma.membership.findUnique({
      where: {
        id: membershipId,
        teamId: organizationId,
      },
    });
  }

  async findOrgMembershipByUserId(organizationId: number, userId: number) {
    return this.dbRead.prisma.membership.findFirst({
      where: {
        teamId: organizationId,
        userId,
      },
    });
  }

  async deleteOrgMembership(organizationId: number, membershipId: number) {
    return this.dbWrite.prisma.membership.delete({
      where: {
        id: membershipId,
        teamId: organizationId,
      },
    });
  }

  async createOrgMembership(organizationId: number, data: CreateOrgMembershipDto) {
    return this.dbWrite.prisma.membership.upsert({
      create: { ...data, teamId: organizationId },
      update: { role: data.role, accepted: data.accepted, disableImpersonation: data.disableImpersonation },
      where: { userId_teamId: { userId: data.userId, teamId: organizationId } },
    });
  }
  async updateOrgMembership(organizationId: number, membershipId: number, data: UpdateOrgMembershipDto) {
    return this.dbWrite.prisma.membership.update({
      data: { ...data },
      where: { id: membershipId, teamId: organizationId },
    });
  }

  async findOrgMembershipsPaginated(organizationId: number, skip: number, take: number) {
    return this.dbRead.prisma.membership.findMany({
      where: {
        teamId: organizationId,
      },
      skip,
      take,
    });
  }
}
