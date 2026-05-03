import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Eye, EyeOff, ArrowLeft, Building2, Clock, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

function RegisterPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<"form" | "done">("form");

  // Form fields
  const [ownerName, setOwnerName] = useState("");
  const [labName, setLabName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  // If user already has a lab, redirect
  useEffect(() => {
    if (user && profile?.lab_id) navigate({ to: "/dashboard" });
  }, [user, profile, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    setBusy(true);

    try {
      // Step 1: Create user account with self_signup flag
      const { data: signupData, error: signupErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
          data: { full_name: ownerName, self_signup: true },
        },
      });
      if (signupErr) throw signupErr;

      const userId = signupData.user?.id;
      if (!userId) throw new Error("فشل إنشاء الحساب");

      // Step 2: Submit lab request
      const { error: reqErr } = await supabase.from("lab_requests").insert({
        user_id: userId,
        owner_name: ownerName,
        lab_name: labName,
        email,
        phone: phone || null,
        address: address || null,
        notes: notes || null,
      });
      if (reqErr) throw reqErr;

      setStep("done");
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ");
    } finally {
      setBusy(false);
    }
  };

  if (step === "done") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4" dir="rtl">
        <div className="max-w-md text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Clock className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">تم إرسال طلبك بنجاح!</h1>
          <p className="text-muted-foreground">
            سيتم مراجعة طلبك من قبل فريق الدعم الفني وسيتم تفعيل معملك
            <strong> "{labName}" </strong>
            في أقرب وقت. ستصلك رسالة على البريد الإلكتروني عند الموافقة.
          </p>
          <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>تم إنشاء حسابك</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <span>بانتظار موافقة الإدارة على المعمل</span>
            </div>
          </div>
          <Link to="/login" className="inline-flex items-center gap-2 text-primary hover:underline text-sm font-medium">
            العودة لتسجيل الدخول
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" dir="rtl">
      {/* Left panel - Branding */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] relative overflow-hidden">
        <div className="absolute inset-0 gradient-primary" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
        <div className="relative z-10 flex flex-col justify-between p-10 xl:p-14 w-full text-primary-foreground">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm font-display font-extrabold text-xl border border-white/20 shadow-lg">
              H
            </div>
            <div>
              <p className="font-display font-bold text-lg tracking-tight">H.A.M.D</p>
              <p className="text-xs text-white/60">Dental Lab Management</p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h1 className="text-3xl xl:text-4xl font-display font-bold leading-tight">
                جرّب النظام
                <br />
                <span className="text-white/80">مجاناً</span>
              </h1>
              <p className="mt-4 text-sm xl:text-base text-white/65 leading-relaxed max-w-sm">
                سجّل معملك واحصل على فترة تجريبية مجانية لاكتشاف كل مميزات النظام
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/10">
                <CheckCircle2 className="h-5 w-5 text-white/80 shrink-0" />
                <span className="text-sm">فترة تجريبية مجانية</span>
              </div>
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/10">
                <CheckCircle2 className="h-5 w-5 text-white/80 shrink-0" />
                <span className="text-sm">جميع المميزات متاحة</span>
              </div>
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/10">
                <CheckCircle2 className="h-5 w-5 text-white/80 shrink-0" />
                <span className="text-sm">دعم فني متواصل</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} H.A.M.D — جميع الحقوق محفوظة
          </p>
        </div>
      </div>

      {/* Right panel - Form */}
      <div className="flex-1 flex items-center justify-center bg-background px-4 py-8 relative">
        <div className="absolute inset-0 gradient-mesh opacity-50" />
        <div className="relative z-10 w-full max-w-[420px] space-y-6">
          <div className="lg:hidden text-center mb-2">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary text-primary-foreground text-2xl font-bold shadow-glow">
              H
            </div>
            <h1 className="font-display font-bold text-xl">H.A.M.D</h1>
            <p className="text-sm text-muted-foreground mt-1">طلب تسجيل معمل جديد</p>
          </div>

          <div className="hidden lg:block">
            <h2 className="text-2xl font-display font-bold text-foreground">طلب تسجيل معمل</h2>
            <p className="text-sm text-muted-foreground mt-1">املأ البيانات وسيتم مراجعة طلبك</p>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ownerName" className="text-sm font-medium">اسمك بالكامل</Label>
                <Input id="ownerName" required value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className="h-10 rounded-xl bg-card border-border/80" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="labName" className="text-sm font-medium">اسم المعمل</Label>
                <Input id="labName" required value={labName} onChange={(e) => setLabName(e.target.value)} placeholder="معمل الابتسامة" className="h-10 rounded-xl bg-card border-border/80" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="regEmail" className="text-sm font-medium">البريد الإلكتروني</Label>
              <Input id="regEmail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" placeholder="email@example.com" className="h-10 rounded-xl bg-card border-border/80" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="regPassword" className="text-sm font-medium">كلمة المرور</Label>
              <div className="relative">
                <Input id="regPassword" type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" placeholder="••••••••" className="h-10 rounded-xl bg-card border-border/80 pe-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="regPhone" className="text-sm font-medium">الهاتف (اختياري)</Label>
                <Input id="regPhone" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" className="h-10 rounded-xl bg-card border-border/80" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="regAddress" className="text-sm font-medium">العنوان (اختياري)</Label>
                <Input id="regAddress" value={address} onChange={(e) => setAddress(e.target.value)} className="h-10 rounded-xl bg-card border-border/80" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="regNotes" className="text-sm font-medium">ملاحظات (اختياري)</Label>
              <Textarea id="regNotes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="أي معلومات إضافية..." className="rounded-xl bg-card border-border/80" />
            </div>
            <Button type="submit" className="w-full h-11 rounded-xl font-semibold text-base gradient-primary hover:opacity-90 transition-all shadow-md" disabled={busy}>
              {busy ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  جارٍ الإرسال...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  إرسال الطلب
                  <ArrowLeft className="h-4 w-4" />
                </span>
              )}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              لديك حساب؟{" "}
              <Link to="/login" className="font-semibold text-primary hover:underline underline-offset-4">
                تسجيل الدخول
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
