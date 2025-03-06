import { defaultResponderForAppDir } from "app/api/defaultResponderForAppDir";
import { cookies, headers } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import handleNewBooking from "@calcom/features/bookings/lib/handleNewBooking";
import { checkRateLimitAndThrowError } from "@calcom/lib/checkRateLimitAndThrowError";
import getIP from "@calcom/lib/getIP";
import { checkCfTurnstileToken } from "@calcom/lib/server/checkCfTurnstileToken";
import { CreationSource } from "@calcom/prisma/enums";

import { buildLegacyRequest } from "@lib/buildLegacyCtx";

async function handler(req: NextRequest) {
  const body = await req.json();
  const legacyRequest = buildLegacyRequest(headers(), cookies());
  const userIp = getIP(legacyRequest);

  if (process.env.NEXT_PUBLIC_CLOUDFLARE_USE_TURNSTILE_IN_BOOKER === "1") {
    await checkCfTurnstileToken({
      token: body["cfToken"] as string,
      remoteIp: userIp,
    });
  }

  await checkRateLimitAndThrowError({
    rateLimitingType: "core",
    identifier: userIp,
  });

  const session = await getServerSession({ req: legacyRequest });
  /* To mimic API behavior and comply with types */
  legacyRequest.userId = session?.user?.id || -1;
  legacyRequest.body = {
    ...body,
    creationSource: CreationSource.WEBAPP,
  };
  const booking = await handleNewBooking(legacyRequest);
  return NextResponse.json(booking);
}

export const POST = defaultResponderForAppDir(handler, "/api/book/event");
