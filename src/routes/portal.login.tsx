import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Stethoscope } from "lucide-react";

export const Route = createFileRoute("/portal/login")({
  component: PortalLoginPage,
});

function PortalLoginPage() {
  const { signIn, user } = useAuth();
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
      // Resolve phone → internal email
      const res = await fetch("/api/portal-resolve-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.email) {
        toast.error(data.error || "رقم الموبايل غير مسجّل");
        setBusy(false);
        return;
      }
      const { error } = await signIn(data.email, password.trim());
      setBusy(false);
      if (error) {
        toast.error("كلمة السر غير صحيحة");
      } else {
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
