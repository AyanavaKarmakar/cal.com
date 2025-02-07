import type z from "zod";

import { hashPassword } from "@calcom/features/auth/lib/hashPassword";
import { checkIfEmailIsBlockedInWatchlistController } from "@calcom/features/watchlist/operations/check-if-email-in-watchlist.controller";
import logger from "@calcom/lib/logger";
import type {
  CreationSource,
  UserPermissionRole,
  IdentityProvider,
  MembershipRole,
} from "@calcom/prisma/enums";
import type { userMetadata } from "@calcom/prisma/zod-utils";

import slugify from "../../slugify";
import { UserRepository } from "../repository/user";

interface CreateUserInput {
  email: string;
  username: string;
  name?: string;
  password?: string;
  brandColor?: string;
  darkBrandColor?: string;
  hideBranding?: boolean;
  weekStart?: string;
  timeZone?: string;
  theme?: string | null;
  timeFormat?: number;
  locale?: string;
  avatar?: string;
  creationSource: CreationSource;
  role?: UserPermissionRole;
  emailVerified?: Date;
  identityProvider?: IdentityProvider;
  identityProviderId?: string;
  metadata?: z.infer<typeof userMetadata>;
}

interface OrgData {
  id: number;
  role: MembershipRole;
  accepted: boolean;
}

const log = logger.getSubLogger({ prefix: ["[userCreationService]"] });

export class UserCreationService {
  static async createUser({ data, orgData }: { data: CreateUserInput; orgData?: OrgData }) {
    const { email, password, username, metadata, ...restUserInput } = data;

    const shouldLockByDefault = await checkIfEmailIsBlockedInWatchlistController(email);

    const hashedPassword = password ? await hashPassword(password) : null;

    const user = await UserRepository.create({
      data: {
        ...restUserInput,
        username: slugify(username),
        email,
        ...(hashedPassword && { hashedPassword }),
        locked: shouldLockByDefault,
        ...(!!metadata && { metadata }),
      },
      ...(orgData ? orgData : {}),
    });

    log.info(`Created user: ${user.id} with locked status of ${user.locked}`);

    const { locked, ...rest } = user;

    return rest;
  }
}
