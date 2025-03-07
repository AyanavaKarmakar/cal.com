import { EventTypeSettingsMap } from "../apps.browser-eventtypesettings.generated";
import type { EventTypeAppSettingsComponentProps } from "../types";
import { DynamicComponent } from "./DynamicComponent";

export const EventTypeAppSettings = (props: EventTypeAppSettingsComponentProps) => {
  const { slug, ...rest } = props;
  return <DynamicComponent slug={slug} componentMap={EventTypeSettingsMap} {...rest} />;
};
