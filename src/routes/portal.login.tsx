import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Stethoscope } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { writeScopedSession } from "@/lib/authScope";

export const Route = createFileRoute("/portal/login")({
  component: PortalLoginPage,
});

function PortalLoginPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/portal/dashboard" });
  }, [user, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !password.trim()) {
      toast.error("أدخل رقم الموبايل وكلمة السر");
      return;
    }
    setBusy(true);
    try {
      // Server-side login — password verified on server, no email exposed
      const res = await fetch("/api/portal-resolve-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), password: password.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.access_token) {
        toast.error(data.error || "بيانات الدخول غير صحيحة");
        setBusy(false);
        return;
      }
      // Set the session in supabase client using the server-returned tokens
      const { data: sessionData, error: setErr } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      setBusy(false);
      if (setErr || !sessionData.session) {
        toast.error("بيانات الدخول غير صحيحة");
      } else {
        // Write scoped session so useAuth picks up the auth state change
        writeScopedSession("portal", sessionData.session);
        toast.success("تم تسجيل الدخول");
        navigate({ to: "/portal/dashboard" });
      }
    } catch {
      setBusy(false);
      toast.error("تعذّر الاتصال بالخادم");
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-secondary to-accent/30 px-4"
      dir="rtl"
    >
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Stethoscope className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl">بورتال الأطباء</CardTitle>
          <CardDescription>سجل الدخول برقم موبايلك وكلمة السر التي زوّدك بها المعمل</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">رقم الموبايل</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="numeric"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                dir="ltr"
                placeholder="01xxxxxxxxx"
                autoComplete="tel"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input
                id="password"
                type="password"
                inputMode="numeric"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                dir="ltr"
                placeholder="٨ أرقام"
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "جارٍ الدخول..." : "تسجيل الدخول"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              لا تملك حساباً؟ تواصل مع المعمل المتعاقد معك للحصول على بياناتك.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
