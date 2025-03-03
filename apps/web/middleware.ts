import { get } from "@vercel/edge-config";
import { collectEvents } from "next-collect/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getLocale } from "@calcom/features/auth/lib/getLocale";
import { extendEventData, nextCollectBasicSettings } from "@calcom/lib/telemetry";

import { csp } from "./lib/csp";

const safeGet = async <T = any>(key: string): Promise<T | undefined> => {
  try {
    return get<T>(key);
  } catch (error) {
    // Don't crash if EDGE_CONFIG env var is missing
  }
};

export const POST_METHODS_ALLOWED_API_ROUTES = ["/api/"]; // trailing slash in "/api/" is actually important to block edge cases like `/api.php`
// Some app routes are allowed because "revalidatePath()" is used to revalidate the cache for them
export const POST_METHODS_ALLOWED_APP_ROUTES = ["/settings/my-account/general"];

export function checkPostMethod(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  if (
    ![...POST_METHODS_ALLOWED_API_ROUTES, ...POST_METHODS_ALLOWED_APP_ROUTES].some((route) =>
      pathname.startsWith(route)
    ) &&
    req.method === "POST"
  ) {
    return new NextResponse(null, {
      status: 405,
      statusText: "Method Not Allowed",
      headers: {
        Allow: "GET",
      },
    });
  }
  return null;
}

const middleware = async (req: NextRequest): Promise<NextResponse<unknown>> => {
  const postCheckResult = checkPostMethod(req);
  if (postCheckResult) return postCheckResult;

  const url = req.nextUrl;
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-url", req.url);
  const locale = await getLocale(req);

  if (!url.pathname.startsWith("/api") && (await safeGet<boolean>("isInMaintenanceMode"))) {
    //
    // NOTE: When tRPC hits an error a 500 is returned, when this is received
    //       by the application the user is automatically redirected to /auth/login.
    //
    //     - For this reason our matchers are sufficient for an app-wide maintenance page.
    //
    // Check whether the maintenance page should be shown
    // If is in maintenance mode, point the url pathname to the maintenance page
    req.nextUrl.pathname = `/${locale}/maintenance`;
    return NextResponse.rewrite(req.nextUrl);
  }

  const routingFormRewriteResponse = routingForms.handleRewrite(url, locale);
  if (routingFormRewriteResponse) {
    return responseWithHeaders({ url, res: routingFormRewriteResponse, req });
  }

  if (url.pathname.startsWith("/api/")) {
    if (url.pathname.startsWith("/api/auth/signup") && (await safeGet<boolean>("isSignupDisabled"))) {
      // If is in maintenance mode, point the url pathname to the maintenance page

      // TODO: Consider using responseWithHeaders here
      return NextResponse.json({ error: "Signup is disabled" }, { status: 503 });
    }

    if (url.pathname.startsWith("/api/trpc/")) {
      requestHeaders.set("x-cal-timezone", req.headers.get("x-vercel-ip-timezone") ?? "");
    }

    return responseWithHeaders({
      url,
      res: NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      }),
      req,
    });
  }

  if (url.pathname.startsWith("/auth/login") || url.pathname.startsWith("/login")) {
    // Use this header to actually enforce CSP, otherwise it is running in Report Only mode on all pages.
    requestHeaders.set("x-csp-enforce", "true");
  }

  if (url.pathname.startsWith("/apps/installed")) {
    const returnTo = req.cookies.get("return-to");

    if (returnTo?.value) {
      const response = NextResponse.redirect(new URL(returnTo.value, req.url), { headers: requestHeaders });
      response.cookies.delete("return-to");
      return response;
    }
  }

  requestHeaders.set("x-pathname", url.pathname);

  requestHeaders.set("x-locale", locale);

  const localeUrl = new URL(req.url);
  localeUrl.pathname = `/${locale}${url.pathname}`;
  const res = NextResponse.rewrite(localeUrl, {
    request: {
      headers: requestHeaders,
    },
  });

  if (url.pathname.startsWith("/auth/logout")) {
    res.cookies.delete("next-auth.session-token");
  }

  return responseWithHeaders({ url, res, req });
};

const routingForms = {
  handleRewrite: (url: URL, locale: string) => {
    // Don't 404 old routing_forms links
    if (url.pathname.startsWith("/apps/routing_forms")) {
      url.pathname = url.pathname.replace(/^\/apps\/routing_forms($|\/)/, `/${locale}/apps/routing-forms/`);
      return NextResponse.rewrite(url);
    }
  },
};

const embeds = {
  addResponseHeaders: ({ url, res }: { url: URL; res: NextResponse }) => {
    if (!url.pathname.endsWith("/embed")) {
      return res;
    }
    const isCOEPEnabled = url.searchParams.get("flag.coep") === "true";
    if (isCOEPEnabled) {
      res.headers.set("Cross-Origin-Embedder-Policy", "require-corp");
    }
    return res;
  },
};

const contentSecurityPolicy = {
  addResponseHeaders: ({ res, req }: { res: NextResponse; req: NextRequest }) => {
    const { nonce } = csp(req, res ?? null);

    if (!process.env.CSP_POLICY) {
      res.headers.set("x-csp", "not-opted-in");
    } else if (!res.headers.get("x-csp")) {
      // If x-csp not set by gSSP, then it's initialPropsOnly
      res.headers.set("x-csp", "initialPropsOnly");
    } else {
      res.headers.set("x-csp", nonce ?? "");
    }
    return res;
  },
};

function responseWithHeaders({ url, res, req }: { url: URL; res: NextResponse; req: NextRequest }) {
  const resWithCSP = contentSecurityPolicy.addResponseHeaders({ res, req });
  const resWithEmbeds = embeds.addResponseHeaders({ url, res: resWithCSP });
  return resWithEmbeds;
}

export const config = {
  // Next.js Doesn't support spread operator in config matcher, so, we must list all paths explicitly here.
  // https://github.com/vercel/next.js/discussions/42458
  matcher: [
    "/403",
    "/500",
    "/icons",
    "/d/:path*",
    "/more/:path*",
    "/maintenance/:path*",
    "/enterprise/:path*",
    "/upgrade/:path*",
    "/connect-and-join/:path*",
    "/insights/:path*",
    "/:path*/embed",
    "/api/auth/signup",
    "/api/trpc/:path*",
    "/login",
    "/apps/:path*",
    "/auth/:path*",
    "/event-types/:path*",
    "/workflows/:path*",
    "/getting-started/:path*",
    "/bookings/:path*",
    "/video/:path*",
    "/teams/:path*",
    "/signup/:path*",
    "/settings/:path*",
    "/reschedule/:path*",
    "/availability/:path*",
    "/booking/:path*",
    "/payment/:path*",
    "/routing-forms/:path*",
    "/team/:path*",
    "/org/:path*",
  ],
};

export default collectEvents({
  middleware,
  ...nextCollectBasicSettings,
  cookieName: "__clnds",
  extend: extendEventData,
});
