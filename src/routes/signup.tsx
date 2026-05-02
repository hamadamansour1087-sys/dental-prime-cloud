import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Eye, EyeOff, ArrowLeft, Building2 } from "lucide-react";

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
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="flex min-h-screen" dir="rtl">
      {/* Left panel - Branding (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] relative overflow-hidden">
        <div className="absolute inset-0 gradient-primary" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
        <div className="absolute top-20 right-12 w-32 h-32 rounded-full bg-white/5 blur-2xl animate-pulse" />
        <div className="absolute bottom-32 left-8 w-48 h-48 rounded-full bg-white/5 blur-3xl" />

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
                ابدأ رحلة إدارة
                <br />
                <span className="text-white/80">معملك الآن</span>
              </h1>
              <p className="mt-4 text-sm xl:text-base text-white/65 leading-relaxed max-w-sm">
                أنشئ حسابك خلال دقيقة واحدة وابدأ في تنظيم عمل معملك باحترافية
              </p>
            </div>

            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
              <Building2 className="h-8 w-8 text-white/80 shrink-0" />
              <div>
                <p className="text-sm font-semibold">+500 معمل يثقون بنا</p>
                <p className="text-xs text-white/55 mt-0.5">انضم لأكبر مجتمع لمعامل الأسنان</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} H.A.M.D — جميع الحقوق محفوظة
          </p>
        </div>
      </div>

      {/* Right panel - Signup form */}
      <div className="flex-1 flex items-center justify-center bg-background px-4 py-8 relative">
        <div className="absolute inset-0 gradient-mesh opacity-50" />
        
        <div className="relative z-10 w-full max-w-[420px] space-y-7">
          <div className="lg:hidden text-center mb-2">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary text-primary-foreground text-2xl font-bold shadow-glow">
              H
            </div>
            <h1 className="font-display font-bold text-xl">H.A.M.D</h1>
            <p className="text-sm text-muted-foreground mt-1">إنشاء معمل جديد</p>
          </div>

          <div className="hidden lg:block">
            <h2 className="text-2xl font-display font-bold text-foreground">إنشاء معمل جديد</h2>
            <p className="text-sm text-muted-foreground mt-1">ابدأ في إدارة معملك خلال دقيقة</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="labName" className="text-sm font-medium">اسم المعمل</Label>
              <Input id="labName" required value={labName} onChange={(e) => setLabName(e.target.value)} placeholder="معمل الابتسامة" className="h-11 rounded-xl bg-card border-border/80 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-sm font-medium">اسمك بالكامل</Label>
              <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-11 rounded-xl bg-card border-border/80 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">البريد الإلكتروني</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" placeholder="email@example.com" className="h-11 rounded-xl bg-card border-border/80 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">كلمة المرور</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" placeholder="••••••••" className="h-11 rounded-xl bg-card border-border/80 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all pe-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full h-11 rounded-xl font-semibold text-base gradient-primary hover:opacity-90 transition-all shadow-md hover:shadow-lg" disabled={busy}>
              {busy ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  جارٍ الإنشاء...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  إنشاء حساب
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
