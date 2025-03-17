import { AppStoreMetadataRepository } from "@calcom/app-store/appStoreMetadataRepository";
import { getUsersCredentials } from "@calcom/lib/server/getUsersCredentials";
import type { TrpcSessionUser } from "@calcom/trpc/server/trpc";

import { TRPCError } from "@trpc/server";

import type { TAppByIdInputSchema } from "./appById.schema";

type AppByIdOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
  input: TAppByIdInputSchema;
};

export const appByIdHandler = async ({ ctx, input }: AppByIdOptions) => {
  const appStoreMetadataRepository = new AppStoreMetadataRepository();
  const { user } = ctx;
  const appId = input.appId;
  const credentials = await getUsersCredentials(user);
  const apps = await appStoreMetadataRepository.getApps(credentials);
  const appFromDb = apps.find((app) => app.slug === appId);
  if (!appFromDb) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Could not find app ${appId}` });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { credential: _, credentials: _1, ...app } = appFromDb;
  return {
    isInstalled: appFromDb.credentials.length,
    ...app,
  };
};
