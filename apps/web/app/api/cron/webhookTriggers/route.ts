import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { handleWebhookScheduledTriggers } from "@calcom/features/webhooks/lib/handleWebhookScheduledTriggers";
import prisma from "@calcom/prisma";

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("authorization") || req.nextUrl.searchParams.get("apiKey");

  if (process.env.CRON_API_KEY !== apiKey) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  await handleWebhookScheduledTriggers(prisma);

  return NextResponse.json({ ok: true });
}
