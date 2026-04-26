import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Truck } from "lucide-react";

export const Route = createFileRoute("/delivery/login")({
  component: DeliveryLogin,
});

function DeliveryLogin() {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (user) navigate({ to: "/" }); }, [user, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !password.trim()) return toast.error("أدخل الموبايل وكلمة السر");
    setBusy(true);
    try {
      const res = await fetch("/api/agent-resolve-login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.email) { toast.error(data.error || "رقم غير مسجّل"); setBusy(false); return; }
      const { error } = await signIn(data.email, password.trim());
      setBusy(false);
      if (error) toast.error("كلمة السر غير صحيحة");
      else { toast.success("أهلاً بك"); navigate({ to: "/" }); }
    } catch { setBusy(false); toast.error("تعذّر الاتصال"); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-secondary to-accent/30 px-4" dir="rtl">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary text-primary-foreground">
            <Truck className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl">بوابة المندوبين</CardTitle>
          <CardDescription>سجل الدخول برقم موبايلك وكلمة السر التي زوّدك بها المعمل</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">رقم الموبايل</Label>
              <Input id="phone" type="tel" inputMode="numeric" required value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" placeholder="01xxxxxxxxx" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input id="password" type="password" inputMode="numeric" required value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" placeholder="٨ أرقام" />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "جارٍ الدخول..." : "دخول"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
