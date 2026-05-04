import type { Session } from "@supabase/supabase-js";

export type AuthScope = "lab" | "portal" | "delivery" | "super-admin";

export const getAuthScope = (): AuthScope => {
  if (typeof window === "undefined") return "lab";
  if (window.location.pathname.startsWith("/super-admin")) return "super-admin";
  if (window.location.pathname.startsWith("/portal")) return "portal";
  if (window.location.pathname.startsWith("/delivery")) return "delivery";
  return "lab";
};

const scopedSessionKey = (scope: AuthScope) => `hamd-auth-scope:${scope}`;

/**
 * Stores ONLY the user ID for scope isolation.
 * Tokens are managed solely by Supabase's built-in storage (localStorage)
 * so they benefit from the SDK's rotation and expiry logic.
 * We never write access_token / refresh_token to sessionStorage.
 */
export const readScopedSession = (scope: AuthScope): Session | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(scopedSessionKey(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { user_id: string };
    // Return a minimal Session-like object with only user id for scope checks
    if (parsed?.user_id) {
      return { user: { id: parsed.user_id } } as unknown as Session;
    }
    return null;
  } catch {
    return null;
  }
};

export const writeScopedSession = (scope: AuthScope, sess: Session) => {
  if (typeof window === "undefined") return;
  // Only store the user ID — never store tokens in sessionStorage
  window.sessionStorage.setItem(
    scopedSessionKey(scope),
    JSON.stringify({ user_id: sess.user?.id }),
  );
};

export const clearScopedSession = (scope: AuthScope) => {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(scopedSessionKey(scope));
  // Also clear legacy key if present
  window.sessionStorage.removeItem(`hamd-auth-session:${scope}`);
};

export const isSameSession = (a: Session | null, b: Session | null) =>
  !!a?.user?.id && !!b?.user?.id && a.user.id === b.user.id;
