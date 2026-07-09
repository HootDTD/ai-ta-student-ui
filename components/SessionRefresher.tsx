"use client";

import { useEffect } from "react";

import { ensureFreshStoredSession } from "@/app/lib/auth";

// Keeps the localStorage Supabase session fresh on EVERY route — the Apollo
// API layer reads the token per-request via loadStoredSession(), so updating
// storage is enough there. Mounted once in app/layout.tsx. A 4-minute tick
// pairs with auth.ts's 7-minute refresh buffer; the visibilitychange handler
// covers wake-from-sleep, where timers didn't fire.
export default function SessionRefresher() {
  useEffect(() => {
    void ensureFreshStoredSession();
    const timer = setInterval(() => void ensureFreshStoredSession(), 240_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void ensureFreshStoredSession();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}
