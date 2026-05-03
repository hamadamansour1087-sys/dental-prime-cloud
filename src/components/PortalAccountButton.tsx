import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { KeyRound, UserCheck, UserX, Copy, RefreshCw } from "lucide-react";

interface Doctor {
  id: string;
  name: string;
  email: string | null;
  phone?: string | null;
  user_id: string | null;
  portal_enabled: boolean;
}

function normalizePhone(p: string): string {
  return p.replace(/[^\d]/g, "").replace(/^00/, "").replace(/^20/, "").replace(/^0+/, "");
}

export function PortalAccountButton({
  doctor,
  onDone,
}: {
  doctor: Doctor;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  const hasAccount = !!doctor.user_id;
  const phoneNorm = doctor.phone ? normalizePhone(doctor.phone) : "";

  const portalUrl =
    typeof window !== "undefined" ? `${window.location.origin}/portal/login` : "/portal/login";

  const passwordToShow = generatedPassword;

  const copyCredentials = async () => {
    if (!passwordToShow) return;
    const text = `بيانات دخول بورتال د. ${doctor.name}\n\nالرابط: ${portalUrl}\nرقم الموبايل: ${phoneNorm}\nكلمة المرور: ${passwordToShow}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("تم نسخ بيانات الدخول");
    } catch {
      toast.error("فشل النسخ");
    }
  };

  const createAccount = async () => {
    if (!doctor.phone) {
      toast.error("أضف رقم موبايل للطبيب أولاً");
      return;
    }
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("يجب تسجيل الدخول");
      const res = await fetch("/api/create-doctor-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ doctor_id: doctor.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل إنشاء الحساب");
      setGeneratedPassword(data.password);
      toast.success("تم إنشاء الحساب — انسخ البيانات وأرسلها للطبيب");
      onDone?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل غير متوقع");
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("يجب تسجيل الدخول");
      const res = await fetch("/api/reset-doctor-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ doctor_id: doctor.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل إعادة تعيين كلمة المرور");
      setGeneratedPassword(data.password);
      toast.success("تم توليد كلمة سر جديدة — انسخها وأرسلها للطبيب");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل غير متوقع");
    } finally {
      setBusy(false);
    }
  };

  const togglePortal = async (enabled: boolean) => {
    const { error } = await supabase
      .from("doctors")
      .update({ portal_enabled: enabled })
      .eq("id", doctor.id);
    if (error) toast.error(error.message);
    else {
      toast.success(enabled ? "تم تفعيل البورتال" : "تم تعطيل البورتال");
      onDone?.();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setGeneratedPassword(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="mt-2 h-7 w-full text-xs">
          {hasAccount ? (
            doctor.portal_enabled ? (
              <>
                <UserCheck className="ml-1 h-3 w-3" />
                البورتال مفعّل
              </>
            ) : (
              <>
                <UserX className="ml-1 h-3 w-3" />
                البورتال معطّل
              </>
            )
          ) : (
            <>
              <KeyRound className="ml-1 h-3 w-3" />
              إنشاء حساب بورتال
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>حساب بورتال د. {doctor.name}</DialogTitle>
          <DialogDescription>
            يدخل الطبيب برقم موبايله المسجّل وكلمة سر مولّدة تلقائياً (٨ أرقام).
          </DialogDescription>
        </DialogHeader>

        {hasAccount ? (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1.5">
              <p className="font-medium">بيانات الدخول</p>
              <p className="text-xs">
                <span className="text-muted-foreground">رقم الموبايل: </span>
                <span dir="ltr" className="font-mono">{phoneNorm || "—"}</span>
              </p>
              <p className="text-xs">
                <span className="text-muted-foreground">كلمة المرور: </span>
                {passwordToShow ? (
                  <span dir="ltr" className="font-mono font-bold text-base">{passwordToShow}</span>
                ) : (
                  <span className="text-muted-foreground italic">
                    غير محفوظة — أعد التوليد لإنشاء كلمة جديدة
                  </span>
                )}
              </p>
              {passwordToShow && (
                <Button type="button" variant="outline" size="sm" onClick={copyCredentials} className="mt-2 h-7 text-xs">
                  <Copy className="ml-1 h-3 w-3" />
                  نسخ بيانات الدخول
                </Button>
              )}
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">تفعيل وصول البورتال</p>
                <p className="text-xs text-muted-foreground">
                  عند التعطيل لن يتمكن الطبيب من تسجيل الدخول
                </p>
              </div>
              <Switch checked={doctor.portal_enabled} onCheckedChange={togglePortal} />
            </div>

            <div className="rounded-md border p-3">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <RefreshCw className="h-3.5 w-3.5" />
                إعادة تعيين كلمة المرور
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                سيتم توليد كلمة سر جديدة بدون حذف الحساب أو بياناته.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 h-7 text-xs"
                disabled={busy}
                onClick={resetPassword}
              >
                <RefreshCw className={`ml-1 h-3 w-3 ${busy ? "animate-spin" : ""}`} />
                {busy ? "جارٍ التوليد..." : "توليد كلمة سر جديدة"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1.5">
              <p className="font-medium text-sm">سيتم إنشاء حساب بهذه البيانات:</p>
              <p>
                <span className="text-muted-foreground">رقم الموبايل: </span>
                {phoneNorm ? (
                  <span dir="ltr" className="font-mono">{phoneNorm}</span>
                ) : (
                  <span className="text-destructive">لم يتم إدخال رقم موبايل للطبيب</span>
                )}
              </p>
              <p className="text-muted-foreground">
                ستُولَّد كلمة سر تلقائية مكوّنة من ٨ أرقام بعد الإنشاء.
              </p>
            </div>

            <DialogFooter>
              <Button onClick={createAccount} disabled={busy || !phoneNorm}>
                <RefreshCw className={`ml-1 h-4 w-4 ${busy ? "animate-spin" : ""}`} />
                {busy ? "جارٍ الإنشاء..." : "إنشاء الحساب وتوليد كلمة السر"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
