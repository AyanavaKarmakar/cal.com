import { PrismaWriteService } from "@/modules/prisma/prisma-write.service";
import { UserWithProfile } from "@/modules/users/users.repository";
import { Logger } from "@nestjs/common";
import { Injectable } from "@nestjs/common";

import { getConnectedApps, ConnectedApps } from "@calcom/platform-libraries";
import { PrismaClient } from "@calcom/prisma";

@Injectable()
export class ConferencingAtomsService {
  private logger = new Logger("ConferencingAtomService");

  constructor(private readonly dbWrite: PrismaWriteService) {}

  async getConferencingApps(user: UserWithProfile, teamId?: number, orgId?: number): Promise<ConnectedApps> {
    return getConnectedApps({
      user,
      input: {
        variant: "conferencing",
        onlyInstalled: true,
        teamId: teamId ?? orgId,
        includeTeamInstalledApps: teamId || orgId ? true : undefined,
      },
      prisma: this.dbWrite.prisma as unknown as PrismaClient,
    });
  }
}
