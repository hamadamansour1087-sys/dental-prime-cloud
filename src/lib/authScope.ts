import type { Session } from "@supabase/supabase-js";

export type AuthScope = "lab" | "portal" | "delivery";

export const getAuthScope = (): AuthScope => {
  if (typeof window === "undefined") return "lab";
  if (window.location.pathname.startsWith("/portal")) return "portal";
  if (window.location.pathname.startsWith("/delivery")) return "delivery";
  return "lab";
};

const scopedSessionKey = (scope: AuthScope) => `hamd-auth-session:${scope}`;

export const readScopedSession = (scope: AuthScope): Session | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(scopedSessionKey(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    return parsed?.access_token && parsed?.refresh_token ? parsed : null;
  } catch {
    return null;
  }
};

export const writeScopedSession = (scope: AuthScope, sess: Session) => {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(scopedSessionKey(scope), JSON.stringify(sess));
};

export const clearScopedSession = (scope: AuthScope) => {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(scopedSessionKey(scope));
};

export const isSameSession = (a: Session | null, b: Session | null) =>
  !!a?.access_token &&
  !!b?.access_token &&
  (a.access_token === b.access_token ||
    a.refresh_token === b.refresh_token ||
    a.user?.id === b.user?.id);
