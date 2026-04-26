import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/" });
  }, [user, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) toast.error(error);
    else {
      toast.success("تم تسجيل الدخول");
      // Route through "/" so role-based redirect picks the right portal
      navigate({ to: "/" });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-secondary to-accent/30 px-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-2xl font-bold">
            H
          </div>
          <CardTitle className="text-2xl">H.A.M.D</CardTitle>
          <CardDescription>نظام إدارة معامل تركيبات الأسنان</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "جارٍ الدخول..." : "تسجيل الدخول"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              ليس لديك حساب؟{" "}
              <Link to="/signup" className="font-medium text-primary hover:underline">
                أنشئ معمل جديد
              </Link>
            </p>
            <p className="text-center text-xs text-muted-foreground">
              طبيب؟{" "}
              <a href="/portal/login" className="font-medium text-primary hover:underline">
                ادخل من بورتال الأطباء
              </a>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
