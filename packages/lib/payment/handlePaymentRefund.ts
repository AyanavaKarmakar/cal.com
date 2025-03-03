import type { Payment, Prisma } from "@prisma/client";

import appStore from "@calcom/app-store";
import type { AppCategories } from "@calcom/prisma/enums";
import type { IAbstractPaymentService, PaymentApp } from "@calcom/types/PaymentService";

const handlePaymentRefund = async (
  paymentId: Payment["id"],
  paymentAppCredentials: {
    key: Prisma.JsonValue;
    appId: string | null;
    app: {
      dirName: string;
      categories: AppCategories[];
    } | null;
  }
) => {
  if (!appStore[paymentAppCredentials?.app?.dirName as keyof typeof appStore]) {
    console.warn(`payment App service of type ${paymentApp} is not implemented`);
    return false;
  }

  const paymentApp = (await import(
    appStore[paymentAppCredentials?.app?.dirName as keyof typeof appStore]
  )) as PaymentApp;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const PaymentService = paymentApp.lib.PaymentService as any;
  const paymentInstance = new PaymentService(paymentAppCredentials) as IAbstractPaymentService;
  const refund = await paymentInstance.refund(paymentId);
  return refund;
};

export { handlePaymentRefund };
