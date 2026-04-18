import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const { signUp, user } = useAuth();
  const navigate = useNavigate();
  const [labName, setLabName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/dashboard" });
  }, [user, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    setBusy(true);
    const { error } = await signUp(email, password, fullName, labName);
    setBusy(false);
    if (error) toast.error(error);
    else {
      toast.success("تم إنشاء المعمل بنجاح");
      navigate({ to: "/dashboard" });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-secondary to-accent/30 px-4 py-8">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-2xl font-bold">
            H
          </div>
          <CardTitle className="text-2xl">إنشاء معمل جديد</CardTitle>
          <CardDescription>ابدأ في إدارة معملك خلال دقيقة</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="labName">اسم المعمل</Label>
              <Input id="labName" required value={labName} onChange={(e) => setLabName(e.target.value)} placeholder="معمل الابتسامة" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">اسمك بالكامل</Label>
              <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "جارٍ الإنشاء..." : "إنشاء حساب"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              لديك حساب؟{" "}
              <Link to="/login" className="font-medium text-primary hover:underline">
                تسجيل الدخول
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
