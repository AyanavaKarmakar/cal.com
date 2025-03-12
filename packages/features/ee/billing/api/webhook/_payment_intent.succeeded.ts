import { NextResponse } from "next/server";

import type { SWHMap } from "./__handler";

// This is a placeholder to showcase adding new event handlers
const handler = async (data: SWHMap["payment_intent.succeeded"]["data"]) => {
  const paymentIntent = data.object;
  // TODO: Implement payment intent succeeded webhook handler
  return NextResponse.json({ success: true });
};

export default handler;
