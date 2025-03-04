import { withAppDirSsr } from "app/WithAppDirSsr";
import type { PageProps } from "app/_types";
import { _generateMetadata, getTranslate } from "app/_utils";
import { cookies, headers } from "next/headers";

import PaymentPage from "@calcom/features/ee/payments/components/PaymentPage";
import { getServerSideProps, type PaymentPageProps } from "@calcom/features/ee/payments/pages/payment";
import { APP_NAME } from "@calcom/lib/constants";

import { buildLegacyCtx } from "@lib/buildLegacyCtx";

export const generateMetadata = async ({ params, searchParams }: PageProps) => {
  const props = await getData(buildLegacyCtx(headers(), cookies(), params, searchParams));
  const eventName = props.booking.title;
  const t = await getTranslate(params.lang);
  return await _generateMetadata(
     `${t("payment")} | ${eventName} | ${APP_NAME}`,
    ""
  );
};

const getData = withAppDirSsr<PaymentPageProps>(getServerSideProps);

const ServerPage = async ({ params, searchParams }: PageProps) => {
  const props = await getData(buildLegacyCtx(headers(), cookies(), params, searchParams));

  return <PaymentPage {...props} />;
};
export default ServerPage;
