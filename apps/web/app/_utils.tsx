import { headers } from "next/headers";
import "server-only";

import type { AppImageProps, MeetingImageProps } from "@calcom/lib/OgImages";
import { constructAppImage, constructGenericImage, constructMeetingImage } from "@calcom/lib/OgImages";
import { IS_CALCOM, WEBAPP_URL, APP_NAME, SEO_IMG_OGIMG, CAL_URL } from "@calcom/lib/constants";
import { buildCanonical } from "@calcom/lib/next-seo.config";
import { truncateOnWord } from "@calcom/lib/text";

const dictionaries = {
  ar: () => import("@calcom/web/public/static/locales/ar/common.json").then((module) => module.default),
  az: () => import("@calcom/web/public/static/locales/az/common.json").then((module) => module.default),
  bg: () => import("@calcom/web/public/static/locales/bg/common.json").then((module) => module.default),
  ca: () => import("@calcom/web/public/static/locales/ca/common.json").then((module) => module.default),
  cs: () => import("@calcom/web/public/static/locales/cs/common.json").then((module) => module.default),
  da: () => import("@calcom/web/public/static/locales/da/common.json").then((module) => module.default),
  de: () => import("@calcom/web/public/static/locales/de/common.json").then((module) => module.default),
  el: () => import("@calcom/web/public/static/locales/el/common.json").then((module) => module.default),
  en: () => import("@calcom/web/public/static/locales/en/common.json").then((module) => module.default),
  es: () => import("@calcom/web/public/static/locales/es/common.json").then((module) => module.default),
  "es-419": () =>
    import("@calcom/web/public/static/locales/es-419/common.json").then((module) => module.default),
  et: () => import("@calcom/web/public/static/locales/et/common.json").then((module) => module.default),
  eu: () => import("@calcom/web/public/static/locales/eu/common.json").then((module) => module.default),
  fi: () => import("@calcom/web/public/static/locales/fi/common.json").then((module) => module.default),
  fr: () => import("@calcom/web/public/static/locales/fr/common.json").then((module) => module.default),
  he: () => import("@calcom/web/public/static/locales/he/common.json").then((module) => module.default),
  hr: () => import("@calcom/web/public/static/locales/hr/common.json").then((module) => module.default),
  hu: () => import("@calcom/web/public/static/locales/hu/common.json").then((module) => module.default),
  id: () => import("@calcom/web/public/static/locales/id/common.json").then((module) => module.default),
  it: () => import("@calcom/web/public/static/locales/it/common.json").then((module) => module.default),
  iw: () => import("@calcom/web/public/static/locales/iw/common.json").then((module) => module.default),
  ja: () => import("@calcom/web/public/static/locales/ja/common.json").then((module) => module.default),
  km: () => import("@calcom/web/public/static/locales/km/common.json").then((module) => module.default),
  ko: () => import("@calcom/web/public/static/locales/ko/common.json").then((module) => module.default),
  lv: () => import("@calcom/web/public/static/locales/lv/common.json").then((module) => module.default),
  nl: () => import("@calcom/web/public/static/locales/nl/common.json").then((module) => module.default),
  no: () => import("@calcom/web/public/static/locales/no/common.json").then((module) => module.default),
  pl: () => import("@calcom/web/public/static/locales/pl/common.json").then((module) => module.default),
  pt: () => import("@calcom/web/public/static/locales/pt/common.json").then((module) => module.default),
  "pt-BR": () =>
    import("@calcom/web/public/static/locales/pt-BR/common.json").then((module) => module.default),
  ro: () => import("@calcom/web/public/static/locales/ro/common.json").then((module) => module.default),
  ru: () => import("@calcom/web/public/static/locales/ru/common.json").then((module) => module.default),
  sk: () => import("@calcom/web/public/static/locales/sk/common.json").then((module) => module.default),
  "sk-SK": () =>
    import("@calcom/web/public/static/locales/sk-SK/common.json").then((module) => module.default),
  sr: () => import("@calcom/web/public/static/locales/sr/common.json").then((module) => module.default),
  sv: () => import("@calcom/web/public/static/locales/sv/common.json").then((module) => module.default),
  ta: () => import("@calcom/web/public/static/locales/ta/common.json").then((module) => module.default),
  th: () => import("@calcom/web/public/static/locales/th/common.json").then((module) => module.default),
  tr: () => import("@calcom/web/public/static/locales/tr/common.json").then((module) => module.default),
  uk: () => import("@calcom/web/public/static/locales/uk/common.json").then((module) => module.default),
  vi: () => import("@calcom/web/public/static/locales/vi/common.json").then((module) => module.default),
  "zh-CN": () =>
    import("@calcom/web/public/static/locales/zh-CN/common.json").then((module) => module.default),
  "zh-TW": () =>
    import("@calcom/web/public/static/locales/zh-TW/common.json").then((module) => module.default),
};

type LocaleType = keyof typeof dictionaries;

export async function getServerTranslation(locale: string) {
  const dict = await dictionaries[locale as LocaleType]();

  return {
    t: (key: string, interpolation?: Record<string, string | number>) => {
      let value = dict[key as keyof typeof dict] as string;
      if (interpolation) {
        Object.entries(interpolation).forEach(([k, v]) => {
          value = value.replace(`{{${k}}}`, String(v));
        });
      }

      return value;
    },
  };
}

export const getTranslate = async (lang: string) => {
  const { t } = await getServerTranslation(lang);
  return t;
};

const _generateMetadataWithoutImage = async (
  title: string,
  description: string,
  hideBranding?: boolean,
  origin?: string,
  pathname?: string
) => {
  const h = headers();
  const _pathname = h.get("x-pathname") ?? pathname ?? "";
  const canonical = buildCanonical({ path: _pathname, origin: origin ?? CAL_URL });
  const titleSuffix = `| ${APP_NAME}`;
  const displayedTitle = title.includes(titleSuffix) || hideBranding ? title : `${title} ${titleSuffix}`;
  const metadataBase = new URL(IS_CALCOM ? "https://cal.com" : WEBAPP_URL);

  return {
    title: title.length === 0 ? APP_NAME : displayedTitle,
    description,
    alternates: { canonical },
    openGraph: {
      description: truncateOnWord(description, 158),
      url: canonical,
      type: "website",
      siteName: APP_NAME,
      title: displayedTitle,
    },
    metadataBase,
  };
};

export const _generateMetadata = async (
  title: string,
  description: string,
  hideBranding?: boolean,
  origin?: string
) => {
  const metadata = await _generateMetadataWithoutImage(title, description, hideBranding, origin);
  const image =
    SEO_IMG_OGIMG +
    constructGenericImage({
      title: metadata.title,
      description: metadata.description,
    });

  return {
    ...metadata,
    openGraph: {
      ...metadata.openGraph,
      images: [image],
    },
  };
};

export const generateMeetingMetadata = async (
  meeting: MeetingImageProps,
  title: string,
  description: string,
  hideBranding?: boolean,
  origin?: string,
  pathname?: string
) => {
  const metadata = await _generateMetadataWithoutImage(title, description, hideBranding, origin, pathname);
  const image = SEO_IMG_OGIMG + constructMeetingImage(meeting);

  return {
    ...metadata,
    openGraph: {
      ...metadata.openGraph,
      images: [image],
    },
  };
};

export const generateAppMetadata = async (
  app: AppImageProps,
  title: string,
  description: string,
  hideBranding?: boolean,
  origin?: string
) => {
  const metadata = await _generateMetadataWithoutImage(title, description, hideBranding, origin);

  const image = SEO_IMG_OGIMG + constructAppImage({ ...app, description: metadata.description });

  return {
    ...metadata,
    openGraph: {
      ...metadata.openGraph,
      images: [image],
    },
  };
};
