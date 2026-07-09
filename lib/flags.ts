// NEXT_PUBLIC_APOLLO_ONLY=1 pins this deployment to the Apollo teach-back
// surface: "/" redirects signed-in users to /apollo and the "Return to Hoot"
// entry points are hidden. The sign-in screen (which lives on "/") is
// unaffected. NEXT_PUBLIC_* is inlined at build time, so the flag is per
// Railway service (pilot prod = on, staging = off), not per user. The backend
// enforces the same policy independently via HOOT_QA_ENABLED (POST /ask 403s).
export const APOLLO_ONLY = ['1', 'true', 'yes', 'on'].includes(
  (process.env.NEXT_PUBLIC_APOLLO_ONLY ?? '').trim().toLowerCase(),
);
