"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { WEBAPP_URL } from "@calcom/lib/constants";

export function useRedirectToLoginIfUnauthenticated(isPublic = false) {
  const loading = status === "loading";
  const router = useRouter();
  useEffect(() => {
    if (isPublic) {
      return;
    }

    if (!loading) {
      const urlSearchParams = new URLSearchParams();
      urlSearchParams.set("callbackUrl", `${WEBAPP_URL}${location.pathname}${location.search}`);
      router.replace(`/auth/login?${urlSearchParams.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isPublic]);

  return {
    loading: false,
  };
}
