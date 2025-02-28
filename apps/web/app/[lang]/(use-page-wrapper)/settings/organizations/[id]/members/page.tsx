import { PageProps } from "app/_types";
import { _generateMetadata, getTranslate } from "app/_utils";

import MembersPage from "~/members/members-view";

export const generateMetadata = async ({ params }: PageProps) => {
  const t = await getTranslate(params.lang as string);
  return await _generateMetadata(t("organization_members"), t("organization_description"));
};

const ServerPageWrapper = () => {
  return <MembersPage />;
};

export default ServerPageWrapper;
