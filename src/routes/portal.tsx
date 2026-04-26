import { createFileRoute, Outlet, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LayoutDashboard, FilePlus2, ClipboardList, Wallet, LogOut, Stethoscope, Search, MessageSquare } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GlobalSearch, useGlobalSearchHotkey } from "@/components/GlobalSearch";
import { PortalNotificationsBell } from "@/components/PortalNotificationsBell";

export const Route = createFileRoute("/portal")({
  component: PortalLayout,
});

const items = [
  { to: "/portal/dashboard", label: "الرئيسية", icon: LayoutDashboard },
  { to: "/portal/new-case", label: "حالة جديدة", icon: FilePlus2 },
  { to: "/portal/cases", label: "حالاتي", icon: ClipboardList },
  { to: "/portal/messages", label: "الرسائل", icon: MessageSquare },
  { to: "/portal/statement", label: "كشف الحساب", icon: Wallet },
] as const;

function PortalLayout() {
  const { user, loading, signOut, roles, profile, labId } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isLoginRoute = location.pathname === "/portal/login";
  const redirectingRef = useRef(false);
  const [searchOpen, setSearchOpen] = useState(false);
  useGlobalSearchHotkey(setSearchOpen);

  const isDeliveryRole = (roles as string[]).includes("delivery");
  const isLabMember = !!(profile && labId);
  // A doctor portal user has neither lab membership nor delivery role
  const isDoctorUser = !!user && !isLabMember && !isDeliveryRole;

  const { data: doctor, isLoading: docLoading } = useQuery({
    queryKey: ["portal-doctor", user?.id],
    enabled: !!user && !isLoginRoute && isDoctorUser,
    queryFn: async () => {
      const { data } = await supabase
        .from("doctors")
        .select("id, name, lab_id, portal_enabled, labs(name)")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (loading || isLoginRoute || redirectingRef.current) return;
    if (!user) {
      redirectingRef.current = true;
      navigate({ to: "/portal/login", replace: true });
      return;
    }
    // Wrong portal: route delivery agents and lab members away
    if (isDeliveryRole) {
      redirectingRef.current = true;
      navigate({ to: "/delivery/dashboard", replace: true });
      return;
    }
    if (isLabMember) {
      redirectingRef.current = true;
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, user, isLoginRoute, navigate, isDeliveryRole, isLabMember]);

  if (loading || (!isLoginRoute && user && docLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isLoginRoute) {
    return <Outlet />;
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!doctor || !doctor.portal_enabled) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4" dir="rtl">
        <div className="max-w-md rounded-lg border bg-card p-6 text-center">
          <Stethoscope className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">حسابك غير مفعّل لبورتال الأطباء</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            هذا الحساب غير مرتبط بسجل طبيب أو تم تعطيل وصوله. تواصل مع المعمل.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={async () => {
              await signOut();
              navigate({ to: "/portal/login" });
            }}
          >
            تسجيل الخروج
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background" dir="rtl">
      <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
              D
            </div>
            <div>
              <p className="text-sm font-semibold">بورتال د. {doctor.name}</p>
              <p className="text-xs text-muted-foreground">{(doctor.labs as any)?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchOpen(true)}
              className="gap-2 text-muted-foreground hover:text-foreground"
              title="بحث (Ctrl+K)"
            >
              <Search className="h-4 w-4" />
              <kbd className="hidden md:inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                ⌘K
              </kbd>
            </Button>
            <PortalNotificationsBell variant="doctor" />
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await signOut();
                navigate({ to: "/portal/login" });
              }}
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">خروج</span>
            </Button>
          </div>
        </div>
      </header>

      <nav className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2">
          {items.map((it) => {
            const active = location.pathname === it.to;
            return (
              <Link
                key={it.to}
                to={it.to}
                className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition ${
                  active
                    ? "border-primary text-primary font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <it.icon className="h-4 w-4" />
                {it.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">
        <Outlet />
      </main>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} variant="portal" />
    </div>
  );
}
