import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearScopedSession, getAuthScope, isSameSession, readScopedSession, writeScopedSession, type AuthScope } from "@/lib/authScope";

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const scopeRef = useRef<AuthScope>(getAuthScope());

  const resetState = useCallback(() => {
    setSession(null);
    setUser(null);
    setProfile(null);
    setRoles([]);
  }, []);

  const loadProfileAndRoles = useCallback(async (uid: string) => {
    const [{ data: prof }, { data: rs }] = await Promise.all([
      supabase.from("profiles").select("id, lab_id, full_name").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role, lab_id").eq("user_id", uid),
    ]);
    setProfile(prof ?? null);
    setRoles(
      ((rs ?? []) as { role: Role; lab_id: string }[])
        .filter((r) => !!prof?.lab_id && r.lab_id === prof.lab_id)
        .map((r) => r.role),
    );
  }, []);

  const applySession = useCallback(
    async (sess: Session | null) => {
      if (!sess) {
        resetState();
        return;
      }
      setSession(sess);
      setUser(sess.user);
      await loadProfileAndRoles(sess.user.id);
    },
    [loadProfileAndRoles, resetState],
  );

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      setLoading(true);
      const scoped = readScopedSession(scopeRef.current);
      if (!scoped) {
        resetState();
        if (mounted) setLoading(false);
        return;
      }

      await applySession(scoped).finally(() => {
        if (mounted) setLoading(false);
      });
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      const scoped = readScopedSession(scopeRef.current);

      if (!isSameSession(sess, scoped)) return;

      setLoading(true);
      if (sess) writeScopedSession(scopeRef.current, sess);
      setTimeout(() => {
        applySession(sess).finally(() => setLoading(false));
      }, 0);
    });

    init();

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [applySession, resetState]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (data.session) {
      writeScopedSession(scopeRef.current, data.session);
      await applySession(data.session);
    }
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
    clearScopedSession(scopeRef.current);
    resetState();
    await supabase.auth.signOut({ scope: "local" });
  };

  const refresh = async () => {
    if (user) await loadProfileAndRoles(user.id);
  };

  const isLabRole = roles.some((r) => r === "admin" || r === "manager" || r === "technician");
  const effectiveLabId = isLabRole ? profile?.lab_id ?? null : null;

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      session,
      profile,
      roles,
      labId: effectiveLabId,
      loading,
      signIn,
      signUp,
      signOut,
      hasRole: (r) => roles.includes(r),
      refresh,
    }),
    [user, session, profile, roles, effectiveLabId, loading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

