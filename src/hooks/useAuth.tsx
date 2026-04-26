import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "manager" | "technician";

interface Profile {
  id: string;
  lab_id: string | null;
  full_name: string | null;
}

interface AuthCtx {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: Role[];
  labId: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, labName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  hasRole: (r: Role) => boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

type AuthScope = "lab" | "portal" | "delivery";

const getAuthScope = (): AuthScope => {
  if (typeof window === "undefined") return "lab";
  if (window.location.pathname.startsWith("/portal")) return "portal";
  if (window.location.pathname.startsWith("/delivery")) return "delivery";
  return "lab";
};

const scopedSessionKey = (scope: AuthScope) => `hamd-auth-session:${scope}`;

const readScopedSession = (scope: AuthScope): Session | null => {
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

const writeScopedSession = (scope: AuthScope, sess: Session) => {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(scopedSessionKey(scope), JSON.stringify(sess));
};

const clearScopedSession = (scope: AuthScope) => {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(scopedSessionKey(scope));
};

const isSameSession = (a: Session | null, b: Session | null) =>
  !!a?.access_token && !!b?.access_token && a.access_token === b.access_token;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const scopeRef = useRef<AuthScope>(getAuthScope());
  const signingOutRef = useRef(false);
  const signingInRef = useRef(false);
  const applyingScopedSessionRef = useRef(false);

  const loadProfileAndRoles = async (uid: string) => {
    const [{ data: prof }, { data: rs }] = await Promise.all([
      supabase.from("profiles").select("id, lab_id, full_name").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile(prof ?? null);
    setRoles(((rs ?? []) as { role: Role }[]).map((r) => r.role));
  };

  useEffect(() => {
    let mounted = true;
    const applyScopedSession = async () => {
      const scoped = readScopedSession(scopeRef.current);
      if (!scoped) return null;
      applyingScopedSessionRef.current = true;
      const { data: setData, error } = await supabase.auth.setSession({
        access_token: scoped.access_token,
        refresh_token: scoped.refresh_token,
      });
      applyingScopedSessionRef.current = false;
      const sess = error ? null : setData.session;
      if (sess) writeScopedSession(scopeRef.current, sess);
      return sess;
    };

    const init = async () => {
      const scoped = readScopedSession(scopeRef.current);
      if (!scoped) {
        setSession(null);
        setUser(null);
        setProfile(null);
        setRoles([]);
        if (mounted) setLoading(false);
        return;
      }
      const sess = await applyScopedSession();
      if (!sess) {
        clearScopedSession(scopeRef.current);
        if (mounted) setLoading(false);
        return;
      }
      if (!mounted) return;
      setSession(sess);
      setUser(sess.user);
      await loadProfileAndRoles(sess.user.id).finally(() => mounted && setLoading(false));
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (signingOutRef.current) return;
      const scoped = readScopedSession(scopeRef.current);
      const shouldAccept = signingInRef.current || applyingScopedSessionRef.current || isSameSession(sess, scoped);

      if (!shouldAccept) {
        if (!sess) return;
        setTimeout(() => {
          applyScopedSession().catch(() => undefined);
        }, 0);
        return;
      }

      signingInRef.current = false;
      if (sess) writeScopedSession(scopeRef.current, sess);
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setLoading(true);
        setTimeout(() => {
          loadProfileAndRoles(sess.user.id).finally(() => setLoading(false));
        }, 0);
      } else {
        setProfile(null);
        setRoles([]);
        setLoading(false);
      }
    });

    init();

    const restoreCurrentScope = () => {
      applyScopedSession().catch(() => undefined);
    };
    const restoreWhenVisible = () => {
      if (document.visibilityState === "visible") restoreCurrentScope();
    };
    window.addEventListener("focus", restoreCurrentScope);
    document.addEventListener("visibilitychange", restoreWhenVisible);

    return () => {
      mounted = false;
      window.removeEventListener("focus", restoreCurrentScope);
      document.removeEventListener("visibilitychange", restoreWhenVisible);
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    signingInRef.current = true;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (data.session) writeScopedSession(scopeRef.current, data.session);
    if (!data.session) signingInRef.current = false;
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string, fullName: string, labName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        data: { full_name: fullName, lab_name: labName },
      },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    signingOutRef.current = true;
    clearScopedSession(scopeRef.current);
    setSession(null);
    setUser(null);
    setProfile(null);
    setRoles([]);
    await supabase.auth.signOut({ scope: "local" });
    signingOutRef.current = false;
  };

  const refresh = async () => {
    if (user) await loadProfileAndRoles(user.id);
  };

  return (
    <Ctx.Provider
      value={{
        user,
        session,
        profile,
        roles,
        labId: profile?.lab_id ?? null,
        loading,
        signIn,
        signUp,
        signOut,
        hasRole: (r) => roles.includes(r),
        refresh,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
