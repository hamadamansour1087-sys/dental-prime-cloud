import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { KeyRound, UserCheck, UserX } from "lucide-react";

interface Doctor {
  id: string;
  name: string;
  email: string | null;
  user_id: string | null;
  portal_enabled: boolean;
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
  const [email, setEmail] = useState(doctor.email ?? "");
  const [password, setPassword] = useState("");

  const hasAccount = !!doctor.user_id;

  const createAccount = async () => {
    if (!email || password.length < 6) {
      toast.error("أدخل بريد صحيح وكلمة سر 6 أحرف على الأقل");
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
        body: JSON.stringify({ doctor_id: doctor.id, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل إنشاء الحساب");
      toast.success("تم إنشاء حساب الطبيب وتفعيل البورتال");
      setOpen(false);
      setPassword("");
      onDone?.();
    } catch (e: any) {
      toast.error(e.message);
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
    <Dialog open={open} onOpenChange={setOpen}>
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
        </DialogHeader>

        {hasAccount ? (
          <div className="space-y-4">
            <div className="rounded-md bg-muted/40 p-3 text-sm">
              <p>الحساب موجود بالفعل.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                البريد: <span dir="ltr">{doctor.email}</span>
              </p>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">تفعيل وصول البورتال</p>
                <p className="text-xs text-muted-foreground">
                  عند التعطيل لن يتمكن الطبيب من تسجيل الدخول
                </p>
              </div>
              <Switch
                checked={doctor.portal_enabled}
                onCheckedChange={togglePortal}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="portal-email">البريد الإلكتروني</Label>
              <Input
                id="portal-email"
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="portal-pass">كلمة المرور المؤقتة</Label>
              <Input
                id="portal-pass"
                type="text"
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6 أحرف على الأقل"
              />
              <p className="text-xs text-muted-foreground">
                أرسل هذه البيانات للطبيب ليستخدمها في تسجيل الدخول على البورتال.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={createAccount} disabled={busy}>
                {busy ? "جارٍ الإنشاء..." : "إنشاء الحساب"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
