import type { App_RoutingForms_Form, User } from "@prisma/client";

import getWebhooks from "@calcom/features/webhooks/lib/getWebhooks";
import { sendGenericWebhookPayload } from "@calcom/features/webhooks/lib/sendPayload";
import getOrgIdFromMemberOrTeamId from "@calcom/lib/getOrgIdFromMemberOrTeamId";
import logger from "@calcom/lib/logger";
import { safeStringify } from "@calcom/lib/safeStringify";
import slugify from "@calcom/lib/slugify";
import { WebhookTriggerEvents } from "@calcom/prisma/client";
import type { Ensure } from "@calcom/types/utils";

import { evaluateRaqbLogic } from "../lib/evaluateRaqbLogic";
import { getAttributesMappedWithTeamMembers } from "../lib/getAttributes";
import { getAttributesForTeam } from "../lib/getAttributes";
import { getQueryBuilderConfigForAttributes } from "../lib/getQueryBuilderConfig";
import isRouter from "../lib/isRouter";
import { Attribute } from "../types/types";
import type { OrderedResponses } from "../types/types";
import type { FormResponse, SerializableForm } from "../types/types";

const moduleLogger = logger.getSubLogger({ prefix: ["routing-forms/trpc/utils"] });
type Field = NonNullable<SerializableForm<App_RoutingForms_Form>["fields"]>[number];

function isOptionsField(field: Pick<Field, "type" | "options">) {
  return (field.type === "select" || field.type === "multiselect") && field.options;
}

function getFieldResponse({
  field,
  fieldResponseValue,
}: {
  fieldResponseValue: FormResponse[keyof FormResponse]["value"];
  field: Pick<Field, "type" | "options">;
}) {
  if (!isOptionsField(field)) {
    return {
      value: fieldResponseValue,
      response: fieldResponseValue,
    };
  }

  if (!field.options) {
    return {
      value: fieldResponseValue,
      response: fieldResponseValue,
    };
  }

  const valueArray = fieldResponseValue instanceof Array ? fieldResponseValue : [fieldResponseValue];
  const chosenOptions = valueArray.map((idOrLabel) => {
    const foundOptionById = field.options?.find((option) => {
      return option.id === idOrLabel;
    });
    if (foundOptionById) {
      return {
        label: foundOptionById.label,
        id: foundOptionById.id,
      };
    } else {
      return {
        label: idOrLabel.toString(),
        id: null,
      };
    }
  });
  return {
    // value is a legacy prop that is just sending the labels which can change
    value: chosenOptions.map((option) => option.label),
    // response is new prop that is sending the label along with id(which doesn't change)
    response: chosenOptions,
  };
}

type SelectFieldWebhookResponse = string | number | string[] | { label: string; id: string | null };
type FORM_SUBMITTED_WEBHOOK_RESPONSES = Record<
  string,
  {
    /**
     * Deprecates `value` prop as it now has both the id(that doesn't change) and the label(that can change but is human friendly)
     */
    response: number | string | string[] | SelectFieldWebhookResponse | SelectFieldWebhookResponse[];
    /**
     * @deprecated Use `response` instead
     */
    value: FormResponse[keyof FormResponse]["value"];
  }
>;

// We connect Form Field value and Attribute value using the labels lowercased
function compatibleForAttributeAndFormFieldMatch(stringOrStringArray: string | string[]) {
  return typeof stringOrStringArray === "string" ? stringOrStringArray.toLowerCase() : stringOrStringArray.map((string) => string.toLowerCase());
}

function getAttributesCompatibleForMatchingWithFormField(attributes: Record<string, string>) {
  return Object.entries(attributes).reduce((acc, [key, value]) => {
    acc[key] = compatibleForAttributeAndFormFieldMatch(value);
    return acc;
  }, {} as Record<string, string>);
}

/**
 * Replaces the field variable(in format {field:<fieldId>}) with the response value of the field
 */
export function replaceFieldVariableInLogicWithResponseValue({
  logic,
  fields,
  response,
  attributes,
}: {
  logic: Object;
  fields: Field[] | undefined;
  response: FormResponse;
  attributes: Attribute[];
}) {
  const log = moduleLogger.getSubLogger({ prefix: ["replaceFieldVariableInLogicWithResponseValue"] });
  log.debug(
    "Replacing field variable in logic with response value",
    safeStringify({ logic, fields, response })
  );

  /**
   * Replace {field:<fieldId>} with the field label(compatible to be matched with attribute value)
   */
  const replaceFieldTemplateVariableWithOptionLabel = (logicString: string) =>
    logicString.replace(/{field:([\w-]+)}/g, (match, fieldId) => {
      const field = fields?.find((f) => f.id === fieldId);
      if (!field) {
        log.debug("field not found", safeStringify({ fieldId }));
        return match;
      }
      const { value: fieldValue } = getFieldResponse({ field, fieldResponseValue: response[fieldId]?.value });
      log.debug("matchingOptionLabel", safeStringify({ fieldValue, response, fieldId }));
      if (fieldValue instanceof Array && fieldValue.length > 1) {
        throw new Error("Array value not supported with 'Value of field'");
      }
      return fieldValue ? compatibleForAttributeAndFormFieldMatch(fieldValue.toString()) : match;
    });

  /**
   * Replace attribute option Ids with the attribute option label(compatible to be matched with form field value)
   */
  const replaceAttributeOptionIdsWithOptionLabel = (logicString: string) => {
    const allAttributesOptions = attributes.map((attribute) => attribute.options).flat();
    // Because all attribute option Ids are unique, we can reliably identify them along any number of attribute options of different attributes
    allAttributesOptions.forEach((attributeOption) => {
      const attributeOptionId = attributeOption.id;
      logicString = logicString.replace(
        new RegExp(`${attributeOptionId}`, "g"),
        compatibleForAttributeAndFormFieldMatch(attributeOption.value)
      );
    });
    return logicString;
  };

  const logicWithFieldValues = JSON.parse(
    replaceAttributeOptionIdsWithOptionLabel(replaceFieldTemplateVariableWithOptionLabel(JSON.stringify(logic)))
  );

  return logicWithFieldValues as Object;
}

export async function findTeamMembersMatchingAttributeLogic({
  form,
  response,
  routeId,
  teamId,
}: {
  form: Pick<SerializableForm<App_RoutingForms_Form>, "routes" | "fields">;
  response: FormResponse;
  routeId: string;
  teamId: number;
}) {
  moduleLogger.debug(
    "Finding team members matching attribute logic",
    safeStringify({ form, response, routeId, teamId })
  );
  const route = form.routes?.find((route) => route.id === routeId);
  if (!route) {
    return null;
  }
  let teamMembersMatchingAttributeLogic: number[] = [];
  if (!isRouter(route)) {
    const attributesQueryValue = route.attributesQueryValue;
    if (!attributesQueryValue) {
      return null;
    }
    const attributes = await getAttributesForTeam({ teamId: teamId });
    const attributesQueryBuilderConfig = getQueryBuilderConfigForAttributes({ attributes, form });
    const teamMembersWithAttributeValues = await getAttributesMappedWithTeamMembers({ teamId: teamId });

    teamMembersWithAttributeValues.forEach((member, index) => {
      const attributesCompatibleForMatchingWithFormField = getAttributesCompatibleForMatchingWithFormField(
        member.attributes
      );
      moduleLogger.debug(
        `Checking team member ${member.userId} with index ${index} with attributes logic`,
        safeStringify({ attributesCompatibleForMatchingWithFormField, attributes: member.attributes })
      );
      const result = evaluateRaqbLogic(
        {
          queryValue: attributesQueryValue,
          queryBuilderConfig: attributesQueryBuilderConfig,
          data: attributesCompatibleForMatchingWithFormField,
        },
        ({ logic }) => {
          return replaceFieldVariableInLogicWithResponseValue({
            logic,
            fields: form.fields,
            response,
            attributes,
          });
        }
      );

      if (result) {
        teamMembersMatchingAttributeLogic.push(member.userId);
      } else {
        moduleLogger.debug(`Team member ${member.userId} does not match attributes logic with index ${index}`);
      }
    });
  }

  return teamMembersMatchingAttributeLogic;
}

export async function onFormSubmission(
  form: Ensure<
    SerializableForm<App_RoutingForms_Form> & { user: Pick<User, "id" | "email">; userWithEmails?: string[] },
    "fields"
  >,
  response: FormResponse
) {
  const fieldResponsesByIdentifier: FORM_SUBMITTED_WEBHOOK_RESPONSES = {};

  for (const [fieldId, fieldResponse] of Object.entries(response)) {
    const field = form.fields.find((f) => f.id === fieldId);
    if (!field) {
      throw new Error(`Field with id ${fieldId} not found`);
    }
    // Use the label lowercased as the key to identify a field.
    const key =
      form.fields.find((f) => f.id === fieldId)?.identifier ||
      (fieldResponse.label as keyof typeof fieldResponsesByIdentifier);
    fieldResponsesByIdentifier[key] = getFieldResponse({
      fieldResponseValue: fieldResponse.value,
      field,
    });
  }

  const { userId, teamId } = getWebhookTargetEntity(form);

  const orgId = await getOrgIdFromMemberOrTeamId({ memberId: userId, teamId });

  const subscriberOptions = {
    userId,
    teamId,
    orgId,
    triggerEvent: WebhookTriggerEvents.FORM_SUBMITTED,
  };

  const webhooks = await getWebhooks(subscriberOptions);

  const promises = webhooks.map((webhook) => {
    sendGenericWebhookPayload({
      secretKey: webhook.secret,
      triggerEvent: "FORM_SUBMITTED",
      createdAt: new Date().toISOString(),
      webhook,
      data: {
        formId: form.id,
        formName: form.name,
        teamId: form.teamId,
        responses: fieldResponsesByIdentifier,
      },
      rootData: {
        // Send responses unwrapped at root level for backwards compatibility
        ...Object.entries(fieldResponsesByIdentifier).reduce((acc, [key, value]) => {
          acc[key] = value.value;
          return acc;
        }, {} as Record<string, FormResponse[keyof FormResponse]["value"]>),
      },
    }).catch((e) => {
      console.error(`Error executing routing form webhook`, webhook, e);
    });
  });

  await Promise.all(promises);
  const orderedResponses = form.fields.reduce((acc, field) => {
    acc.push(response[field.id]);
    return acc;
  }, [] as OrderedResponses);

  if (form.settings?.emailOwnerOnSubmission) {
    moduleLogger.debug(
      `Preparing to send Form Response email for Form:${form.id} to form owner: ${form.user.email}`
    );
    await sendResponseEmail(form, orderedResponses, [form.user.email]);
  } else if (form.userWithEmails?.length) {
    moduleLogger.debug(
      `Preparing to send Form Response email for Form:${form.id} to users: ${form.userWithEmails.join(",")}`
    );
    await sendResponseEmail(form, orderedResponses, form.userWithEmails);
  }
}

export const sendResponseEmail = async (
  form: Pick<App_RoutingForms_Form, "id" | "name">,
  orderedResponses: OrderedResponses,
  toAddresses: string[]
) => {
  try {
    if (typeof window === "undefined") {
      const { default: ResponseEmail } = await import("../emails/templates/response-email");
      const email = new ResponseEmail({ form: form, toAddresses, orderedResponses });
      await email.sendEmail();
    }
  } catch (e) {
    moduleLogger.error("Error sending response email", e);
  }
};

function getWebhookTargetEntity(form: { teamId?: number | null; user: { id: number } }) {
  // If it's a team form, the target must be team webhook
  // If it's a user form, the target must be user webhook
  const isTeamForm = form.teamId;
  return { userId: isTeamForm ? null : form.user.id, teamId: isTeamForm ? form.teamId : null };
}
