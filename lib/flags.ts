// NEXT_PUBLIC_APOLLO_ONLY=1 pins this deployment to the Apollo teach-back
// surface: "/" redirects signed-in users to /apollo and the "Return to Hoot"
// entry points are hidden. The sign-in screen (which lives on "/") is
// unaffected. NEXT_PUBLIC_* is inlined at build time, so the flag is per
// Railway service (pilot prod = on, staging = off), not per user. The backend
// enforces the same policy independently via HOOT_QA_ENABLED (POST /ask 403s).
export const APOLLO_ONLY = ['1', 'true', 'yes', 'on'].includes(
  (process.env.NEXT_PUBLIC_APOLLO_ONLY ?? '').trim().toLowerCase(),
);

const ON_TOKENS = ['1', 'true', 'yes', 'on'];
const OFF_TOKENS = ['0', 'false', 'no', 'off'];

// Apollo turn transport. Streaming (SSE, POST .../chat/stream) is the DEFAULT;
// the flag exists to fall back to the blocking POST .../chat, which stays a
// complete, first-class path. Default-on means an unset variable streams, so
// the fallback is an explicit act.
export const APOLLO_TURN_STREAMING_DEFAULT = !OFF_TOKENS.includes(
  (process.env.NEXT_PUBLIC_APOLLO_TURN_STREAMING ?? '').trim().toLowerCase(),
);

// Per-device runtime override, read on every send. It exists because
// NEXT_PUBLIC_* is inlined at BUILD time: killing the fleet-wide default costs
// a Railway variable change *plus* a redeploy (Railway is known to skip
// variable-only redeploys), which is too slow to be the only kill switch
// during a live study session. Setting this key turns streaming off for one
// browser immediately, no deploy:
//   localStorage.setItem('hoot.apollo.turn_streaming', 'off')
// Remove the key (or set it to an on-token) to return to the build default.
export const APOLLO_TURN_STREAMING_KEY = 'hoot.apollo.turn_streaming';

export function apolloTurnStreamingEnabled(): boolean {
  if (typeof window === 'undefined') return APOLLO_TURN_STREAMING_DEFAULT;
  let override: string | null = null;
  try {
    override = window.localStorage.getItem(APOLLO_TURN_STREAMING_KEY);
  } catch {
    // Storage blocked (private mode / hardened settings): fall back to the
    // build-time default rather than failing the send.
    return APOLLO_TURN_STREAMING_DEFAULT;
  }
  const token = (override ?? '').trim().toLowerCase();
  if (OFF_TOKENS.includes(token)) return false;
  if (ON_TOKENS.includes(token)) return true;
  return APOLLO_TURN_STREAMING_DEFAULT;
}
