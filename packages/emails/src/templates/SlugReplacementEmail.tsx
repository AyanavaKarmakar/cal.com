import type { TFunction } from "i18next";

import { WEBAPP_URL } from "@calcom/lib/constants";
import CustomTrans from "@calcom/web/components/CustomTrans";

import { BaseEmailHtml, CallToAction } from "../components";

export const SlugReplacementEmail = (
  props: {
    slug: string;
    name: string;
    teamName: string;
    t: TFunction;
  } & Partial<React.ComponentProps<typeof BaseEmailHtml>>
) => {
  const { slug, name, teamName, t } = props;

  return (
    <BaseEmailHtml
      subject={t("email_subject_slug_replacement", { slug: slug })}
      headerType="teamCircle"
      title={t("event_replaced_notice")}>
      <>
        <CustomTrans t={t} i18nKey="hi_user_name" values={{ name }}>
          <p style={{ fontWeight: 400, lineHeight: "24px", display: "inline-block" }}>Hi {name}</p>
          <p style={{ display: "inline" }}>,</p>
        </CustomTrans>
        <CustomTrans i18nKey="email_body_slug_replacement_notice" t={t} values={{ slug }}>
          <p style={{ fontWeight: 400, lineHeight: "24px" }}>
            An administrator on the <strong>{teamName}</strong> team has replaced your event type{" "}
            <strong>/{slug}</strong> with a managed event type that they control.
          </p>
        </CustomTrans>
        <CustomTrans i18nKey="email_body_slug_replacement_info" t={t}>
          <p style={{ fontWeight: 400, lineHeight: "24px" }}>
            Your link will continue to work but some settings for it may have changed. You can review it in
            event types.
          </p>
        </CustomTrans>
        <table
          role="presentation"
          border={0}
          style={{ verticalAlign: "top", marginTop: "25px" }}
          width="100%">
          <tbody>
            <tr>
              <td align="center">
                <CallToAction
                  label={t("review_event_type")}
                  href={`${WEBAPP_URL}/event-types`}
                  endIconName="white-arrow-right"
                />
              </td>
            </tr>
          </tbody>
        </table>
        <p
          style={{
            borderTop: "solid 1px #E1E1E1",
            fontSize: 1,
            margin: "35px auto",
            width: "100%",
          }}
        />
        <CustomTrans i18nKey="email_body_slug_replacement_suggestion" t={t}>
          <p style={{ fontWeight: 400, lineHeight: "24px" }}>
            If you have any questions about the event type, please reach out to your administrator.
            <br />
            <br />
            Happy scheduling, <br />
            The Cal.com team
          </p>
        </CustomTrans>
        {/*<p style={{ fontWeight: 400, lineHeight: "24px" }}>
          <>{t("email_body_slug_replacement_suggestion")}</>
        </p>*/}
      </>
    </BaseEmailHtml>
  );
};
