import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Eye, EyeOff, ArrowLeft, Shield, Zap, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/dashboard" });
  }, [user, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) toast.error(error);
    else {
      toast.success("تم تسجيل الدخول");
      navigate({ to: "/dashboard" });
    }
  };

  const features = [
    { icon: Zap, title: "إدارة ذكية للحالات", desc: "تتبع كل حالة من الاستلام حتى التسليم" },
    { icon: BarChart3, title: "تقارير وتحليلات", desc: "رؤية شاملة لأداء معملك لحظة بلحظة" },
    { icon: Shield, title: "أمان وموثوقية", desc: "بياناتك محمية بأعلى معايير الأمان" },
  ];

  return (
    <div className="flex min-h-screen" dir="rtl">
      {/* Left panel - Branding (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] relative overflow-hidden">
        <div className="absolute inset-0 gradient-primary" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
        
        {/* Floating shapes */}
        <div className="absolute top-20 right-12 w-32 h-32 rounded-full bg-white/5 blur-2xl animate-pulse" />
        <div className="absolute bottom-32 left-8 w-48 h-48 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute top-1/2 right-1/3 w-24 h-24 rounded-2xl bg-white/5 blur-xl rotate-45" />

        <div className="relative z-10 flex flex-col justify-between p-10 xl:p-14 w-full text-primary-foreground">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm font-display font-extrabold text-xl border border-white/20 shadow-lg">
              H
            </div>
            <div>
              <p className="font-display font-bold text-lg tracking-tight">H.A.M.D</p>
              <p className="text-xs text-white/60">Dental Lab Management</p>
            </div>
          </div>

          {/* Center content */}
          <div className="space-y-8">
            <div>
              <h1 className="text-3xl xl:text-4xl font-display font-bold leading-tight">
                نظام إدارة معامل
                <br />
                <span className="text-white/80">تركيبات الأسنان</span>
              </h1>
              <p className="mt-4 text-sm xl:text-base text-white/65 leading-relaxed max-w-sm">
                حل متكامل لإدارة معملك بكفاءة عالية — من استقبال الحالات حتى التسليم والتحصيل
              </p>
            </div>

            <div className="space-y-5">
              {features.map((f, i) => (
                <div key={i} className="flex items-start gap-3 group">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 group-hover:bg-white/15 transition-colors">
                    <f.icon className="h-5 w-5 text-white/90" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{f.title}</p>
                    <p className="text-xs text-white/55 mt-0.5">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} H.A.M.D — جميع الحقوق محفوظة
          </p>
        </div>
      </div>

      {/* Right panel - Login form */}
      <div className="flex-1 flex items-center justify-center bg-background px-4 py-8 relative">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 gradient-mesh opacity-50" />
        
        <div className="relative z-10 w-full max-w-[420px] space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-2">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary text-primary-foreground text-2xl font-bold shadow-glow">
              H
            </div>
            <h1 className="font-display font-bold text-xl">H.A.M.D</h1>
            <p className="text-sm text-muted-foreground mt-1">نظام إدارة معامل تركيبات الأسنان</p>
          </div>

          {/* Form header */}
          <div className="hidden lg:block">
            <h2 className="text-2xl font-display font-bold text-foreground">مرحباً بك</h2>
            <p className="text-sm text-muted-foreground mt-1">سجّل دخولك للمتابعة إلى لوحة التحكم</p>
          </div>

          {/* Form */}
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                dir="ltr"
                placeholder="email@example.com"
                className="h-11 rounded-xl bg-card border-border/80 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">كلمة المرور</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  dir="ltr"
                  placeholder="••••••••"
                  className="h-11 rounded-xl bg-card border-border/80 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all pe-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 rounded-xl font-semibold text-base gradient-primary hover:opacity-90 transition-all shadow-md hover:shadow-lg"
              disabled={busy}
            >
              {busy ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  جارٍ الدخول...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  تسجيل الدخول
                  <ArrowLeft className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          {/* Links */}
          <div className="space-y-3 pt-2">
            <p className="text-center text-sm text-muted-foreground">
              ليس لديك حساب؟{" "}
              <Link to="/signup" className="font-semibold text-primary hover:underline underline-offset-4 transition-colors">
                أنشئ معمل جديد
              </Link>
            </p>
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">أو</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <p className="text-center text-xs text-muted-foreground">
              طبيب؟{" "}
              <a href="/portal/login" className="font-medium text-primary hover:underline underline-offset-4">
                ادخل من بورتال الأطباء
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
