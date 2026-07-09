"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  SUPABASE_AUTH_ENABLED,
  loadStoredSession,
  saveStoredSession,
  ensureActiveSession,
  signInWithPassword,
  signUpWithPassword,
  type StoredSession,
} from "../../lib/auth";
import AuthBrand from "../../../components/AuthBrand";
import BootScreen from "../../../components/BootScreen";

type ResolvedLink = {
  search_space_id: number;
  course_name: string;
  role: string;
};

type RedeemResult = {
  success: boolean;
  search_space_id: number;
  role: string;
  course_name: string;
};

export default function JoinPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = params.code;

  const [resolved, setResolved] = useState<ResolvedLink | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [session, setSession] = useState<StoredSession | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState(false);

  // Restore session on mount
  useEffect(() => {
    (async () => {
      const stored = loadStoredSession();
      const active = await ensureActiveSession(stored);
      if (active) {
        setSession(active);
        saveStoredSession(active);
      }
      setAuthReady(true);
    })();
  }, []);

  // Resolve invite code
  useEffect(() => {
    if (!code) return;
    setLoading(true);
    (async () => {
      try {
        const resp = await fetch(`/api/invite-links/resolve/${encodeURIComponent(code)}`);
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          throw new Error(
            (body as { detail?: string }).detail || `Invalid invite code (${resp.status})`
          );
        }
        const data: ResolvedLink = await resp.json();
        setResolved(data);
        setResolveError(null);
      } catch (err) {
        setResolveError(err instanceof Error ? err.message : "Failed to resolve invite code");
        setResolved(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [code]);

  // Auto-redeem when session is available and link is resolved
  const redeem = useCallback(
    async (token: string) => {
      if (!code || redeemSuccess) return;
      setRedeemError(null);
      try {
        const resp = await fetch(`/api/invite-links/redeem/${encodeURIComponent(code)}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          throw new Error(
            (body as { detail?: string }).detail || `Failed to join class (${resp.status})`
          );
        }
        const data: RedeemResult = await resp.json();
        if (data.success) {
          setRedeemSuccess(true);
          setTimeout(() => router.push("/"), 1500);
        }
      } catch (err) {
        setRedeemError(err instanceof Error ? err.message : "Failed to redeem invite code");
      }
    },
    [code, redeemSuccess, router]
  );

  useEffect(() => {
    if (session?.access_token && resolved && !redeemSuccess) {
      void redeem(session.access_token);
    }
  }, [session, resolved, redeemSuccess, redeem]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      const sess = await signInWithPassword(email, password);
      saveStoredSession(sess);
      setSession(sess);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignUp = async () => {
    setAuthLoading(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      const result = await signUpWithPassword(email, password);
      if (result.session) {
        saveStoredSession(result.session);
        setSession(result.session);
      } else if (result.requiresEmailConfirmation) {
        setAuthNotice("Check your email to confirm your account, then sign in.");
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Sign up failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  if (!SUPABASE_AUTH_ENABLED) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <AuthBrand />
          <div className="notice" data-tone="danger">Hoot isn&apos;t fully set up yet. Please contact your administrator.</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="auth-screen">
        <BootScreen label="Checking your invite…" />
      </div>
    );
  }

  if (resolveError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="module w-full max-w-sm">
          <h1 className="section-title">Invalid Invite Link</h1>
          <div className="notice" data-tone="danger">
            {resolveError}
          </div>
          <p className="note mt-3">
            Ask your instructor for a valid class code.
          </p>
        </div>
      </div>
    );
  }

  // Success screen
  if (redeemSuccess && resolved) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <AuthBrand />
          <h1 className="section-title" style={{ fontSize: '1.4rem', textAlign: 'center' }}>You&apos;re in!</h1>
          <p className="note" style={{ textAlign: 'center', margin: 0 }}>
            Joined <strong>{resolved.course_name}</strong> as {resolved.role}.
          </p>
          <p className="note" style={{ textAlign: 'center', margin: 0 }}>Redirecting to Hoot…</p>
        </div>
      </div>
    );
  }

  // Not logged in — show auth form with course context
  if (!session && authReady) {
    return (
      <div className="auth-screen">
        <form onSubmit={handleSignIn} className="auth-card">
          <AuthBrand />
          <div style={{ textAlign: 'center' }}>
            <h1 className="section-title" style={{ fontSize: '1.3rem' }}>Join {resolved?.course_name ?? 'this course'}</h1>
            <p className="note" style={{ margin: '0.3rem 0 0' }}>Sign in or create an account to join this class.</p>
          </div>
          {authError && (
            <div className="notice" data-tone="danger">
              {authError}
            </div>
          )}
          {authNotice && <div className="notice" data-tone="success">{authNotice}</div>}
          <label className="field-label">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="input"
            />
          </label>
          <label className="field-label">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="input"
            />
          </label>
          <button
            type="submit"
            disabled={authLoading}
            className="ui-button ui-button--primary ui-button--full"
          >
            {authLoading ? "Signing in…" : "Sign in"}
          </button>
          <button
            type="button"
            disabled={authLoading}
            onClick={handleSignUp}
            className="ui-button ui-button--ghost ui-button--full"
          >
            {authLoading ? "Working…" : "New here? Create an account"}
          </button>
        </form>
      </div>
    );
  }

  // Logged in, redeeming in progress
  return (
    <div className="auth-screen">
      <BootScreen label={`Enrolling you in ${resolved?.course_name ?? 'your class'}…`} />
      {redeemError && (
        <div className="notice" data-tone="danger">
          {redeemError}
        </div>
      )}
    </div>
  );
}
