import { createFileRoute, Outlet, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Truck, LayoutDashboard, ClipboardCheck, Wallet, LogOut } from "lucide-react";

export const Route = createFileRoute("/delivery")({
  component: DeliveryLayout,
});

const items = [
  { to: "/delivery/dashboard", label: "حالاتي", icon: LayoutDashboard },
  { to: "/delivery/delivered", label: "المسلّمة", icon: ClipboardCheck },
  { to: "/delivery/payments", label: "السندات", icon: Wallet },
] as const;

function DeliveryLayout() {
  const { user, loading, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isLoginRoute = location.pathname === "/delivery/login";
  const redirectingRef = useRef(false);

  const { data: agent, isLoading: agentLoading } = useQuery({
    queryKey: ["delivery-agent-self", user?.id],
    enabled: !!user && !isLoginRoute,
    queryFn: async () => {
      const { data } = await supabase
        .from("delivery_agents")
        .select("id, name, lab_id, route_id, governorates, is_active, labs(name)")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!loading && !user && !isLoginRoute && !redirectingRef.current) {
      redirectingRef.current = true;
      navigate({ to: "/delivery/login", replace: true });
      return;
    }
    redirectingRef.current = false;
  }, [loading, user, isLoginRoute, navigate]);

  if (loading || (!isLoginRoute && user && agentLoading)) {
    return <div className="flex min-h-screen items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  if (isLoginRoute) return <Outlet />;
  if (!user) return <div className="flex min-h-screen items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  if (!agent || !agent.is_active) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4" dir="rtl">
        <div className="max-w-md rounded-lg border bg-card p-6 text-center">
          <Truck className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">حساب المندوب غير مفعّل</h2>
          <p className="mt-2 text-sm text-muted-foreground">تواصل مع المعمل لتفعيل الوصول.</p>
          <Button variant="outline" className="mt-4" onClick={async () => { await signOut(); navigate({ to: "/delivery/login" }); }}>
            تسجيل الخروج
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-16" dir="rtl">
      <header className="sticky top-0 z-10 border-b bg-card/90 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary text-primary-foreground"><Truck className="h-5 w-5" /></div>
            <div>
              <p className="text-sm font-semibold">{agent.name}</p>
              <p className="text-xs text-muted-foreground">{(agent.labs as any)?.name}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate({ to: "/delivery/login" }); }}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4"><Outlet /></main>

      <nav className="fixed bottom-0 inset-x-0 z-10 border-t bg-card">
        <div className="grid grid-cols-3">
          {items.map((it) => {
            const active = location.pathname === it.to || (it.to === "/delivery/dashboard" && location.pathname === "/delivery");
            return (
              <Link key={it.to} to={it.to}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-xs ${active ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                <it.icon className="h-5 w-5" />
                {it.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
