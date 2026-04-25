import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { UserPlus, Shield, Trash2, Power, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

type AppRole = "admin" | "manager" | "technician";

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "مدير",
  manager: "مشرف",
  technician: "فني",
};

const ROLE_COLORS: Record<AppRole, string> = {
  admin: "bg-primary text-primary-foreground",
  manager: "bg-warning/15 text-warning border border-warning/30",
  technician: "bg-muted text-muted-foreground",
};

export const Route = createFileRoute("/_app/users")({
  component: UsersPage,
});

function UsersPage() {
  const { labId, user, hasRole, session } = useAuth();
  const qc = useQueryClient();
  const isAdmin = hasRole("admin");

  const { data: users, isLoading } = useQuery({
    queryKey: ["lab-users", labId],
    enabled: !!labId,
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("lab_id", labId!).order("full_name"),
        supabase.from("user_roles").select("user_id, role").eq("lab_id", labId!),
      ]);
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: ((roles ?? []) as { user_id: string; role: AppRole }[])
          .filter((r) => r.user_id === p.id)
          .map((r) => r.role),
      }));
    },
  });

  const callApi = async (body: Record<string, unknown>) => {
    const token = session?.access_token;
    const res = await fetch("/api/manage-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token ?? ""}`,
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || data.error) throw new Error(data.error ?? "فشل التنفيذ");
    return data;
  };

  const inviteMut = useMutation({
    mutationFn: async (payload: {
      email: string;
      password: string;
      full_name: string;
      phone?: string;
      roles: AppRole[];
    }) => callApi({ ...payload, action: "invite", lab_id: labId }),
    onSuccess: () => {
      toast.success("تمت دعوة المستخدم");
      qc.invalidateQueries({ queryKey: ["lab-users", labId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setRolesMut = useMutation({
    mutationFn: async (payload: { user_id: string; roles: AppRole[] }) =>
      callApi({ ...payload, action: "set_roles", lab_id: labId }),
    onSuccess: () => {
      toast.success("تم تحديث الصلاحيات");
      qc.invalidateQueries({ queryKey: ["lab-users", labId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActiveMut = useMutation({
    mutationFn: async (payload: { user_id: string; activate: boolean }) =>
      callApi({
        action: payload.activate ? "activate" : "deactivate",
        lab_id: labId,
        user_id: payload.user_id,
      }),
    onSuccess: () => {
      toast.success("تم التحديث");
      qc.invalidateQueries({ queryKey: ["lab-users", labId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: async (user_id: string) =>
      callApi({ action: "remove", lab_id: labId, user_id }),
    onSuccess: () => {
      toast.success("تمت الإزالة من المعمل");
      qc.invalidateQueries({ queryKey: ["lab-users", labId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">المستخدمون والصلاحيات</h1>
          <p className="text-sm text-muted-foreground">
            إدارة فريق المعمل ودعوة أعضاء جدد وتحديد أدوارهم
          </p>
        </div>
        {isAdmin && <InviteDialog onInvite={(p) => inviteMut.mutate(p)} pending={inviteMut.isPending} />}
      </div>

      {!isAdmin && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="flex items-center gap-3 p-4">
            <ShieldAlert className="h-5 w-5 text-warning" />
            <p className="text-sm text-warning-foreground">
              يمكنك عرض الفريق فقط. إدارة الصلاحيات تتطلب دور "مدير".
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">أعضاء المعمل ({users?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p className="text-center text-sm text-muted-foreground py-6">جاري التحميل...</p>}
          {users?.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-6">لا يوجد أعضاء بعد</p>
          )}
          {users?.map((u) => (
            <div
              key={u.id}
              className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground font-semibold">
                  {(u.full_name ?? "?").slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium truncate">{u.full_name ?? "—"}</p>
                    {u.id === user?.id && (
                      <Badge variant="outline" className="text-[10px]">أنت</Badge>
                    )}
                    {!u.is_active && (
                      <Badge variant="destructive" className="text-[10px]">معطّل</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{u.phone ?? "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {u.roles.length === 0 && (
                  <span className="text-xs text-muted-foreground">بلا صلاحيات</span>
                )}
                {u.roles.map((r) => (
                  <span
                    key={r}
                    className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLORS[r]}`}
                  >
                    {ROLE_LABELS[r]}
                  </span>
                ))}
                {isAdmin && (
                  <>
                    <RolesDialog
                      userName={u.full_name ?? "مستخدم"}
                      currentRoles={u.roles}
                      onSave={(roles) => setRolesMut.mutate({ user_id: u.id, roles })}
                      pending={setRolesMut.isPending}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      title={u.is_active ? "تعطيل" : "تفعيل"}
                      onClick={() =>
                        toggleActiveMut.mutate({ user_id: u.id, activate: !u.is_active })
                      }
                    >
                      <Power className={`h-4 w-4 ${u.is_active ? "text-success" : "text-muted-foreground"}`} />
                    </Button>
                    {u.id !== user?.id && (
                      <RemoveButton
                        name={u.full_name ?? "المستخدم"}
                        onConfirm={() => removeMut.mutate(u.id)}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            دليل الصلاحيات
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <RoleCard role="admin" desc="كامل الصلاحيات: المستخدمون، الإعدادات، الأسعار، حذف البيانات" />
          <RoleCard role="manager" desc="إدارة العمل اليومي: حالات، فواتير، مدفوعات، فنيون، مخزون" />
          <RoleCard role="technician" desc="عرض الحالات وتغيير المراحل فقط (بدون مالية)" />
        </CardContent>
      </Card>
    </div>
  );
}

function RoleCard({ role, desc }: { role: AppRole; desc: string }) {
  return (
    <div className="rounded-lg border p-3">
      <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLORS[role]}`}>
        {ROLE_LABELS[role]}
      </span>
      <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}

function InviteDialog({
  onInvite,
  pending,
}: {
  onInvite: (p: { email: string; password: string; full_name: string; phone?: string; roles: AppRole[] }) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    phone: "",
    roles: ["technician"] as AppRole[],
  });

  const submit = () => {
    if (!form.email || !form.full_name || form.password.length < 6) {
      toast.error("الحقول المطلوبة: الاسم، البريد، كلمة سر (٦ أحرف على الأقل)");
      return;
    }
    onInvite({
      email: form.email,
      password: form.password,
      full_name: form.full_name,
      phone: form.phone || undefined,
      roles: form.roles,
    });
    setOpen(false);
    setForm({ email: "", password: "", full_name: "", phone: "", roles: ["technician"] });
  };

  const toggleRole = (r: AppRole) => {
    setForm((f) => ({
      ...f,
      roles: f.roles.includes(r) ? f.roles.filter((x) => x !== r) : [...f.roles, r],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="ml-2 h-4 w-4" /> دعوة عضو جديد
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>دعوة عضو جديد للمعمل</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>الاسم الكامل *</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <Label>البريد الإلكتروني *</Label>
            <Input
              type="email"
              dir="ltr"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <Label>كلمة المرور المؤقتة *</Label>
            <Input
              type="text"
              dir="ltr"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="٦ أحرف على الأقل"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              شارك كلمة المرور مع العضو. يمكنه تغييرها لاحقًا.
            </p>
          </div>
          <div>
            <Label>الجوال</Label>
            <Input dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <Label>الأدوار</Label>
            <div className="mt-2 space-y-2">
              {(["admin", "manager", "technician"] as AppRole[]).map((r) => (
                <label key={r} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={form.roles.includes(r)} onCheckedChange={() => toggleRole(r)} />
                  <span className="text-sm">{ROLE_LABELS[r]}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "جارٍ الدعوة..." : "دعوة"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RolesDialog({
  userName,
  currentRoles,
  onSave,
  pending,
}: {
  userName: string;
  currentRoles: AppRole[];
  onSave: (roles: AppRole[]) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [roles, setRoles] = useState<AppRole[]>(currentRoles);

  const toggleRole = (r: AppRole) => {
    setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setRoles(currentRoles);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="تعديل الصلاحيات">
          <Shield className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>صلاحيات: {userName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {(["admin", "manager", "technician"] as AppRole[]).map((r) => (
            <label key={r} className="flex items-center gap-2 cursor-pointer rounded-md border p-2 hover:bg-accent">
              <Checkbox checked={roles.includes(r)} onCheckedChange={() => toggleRole(r)} />
              <span className="text-sm font-medium">{ROLE_LABELS[r]}</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button
            onClick={() => {
              onSave(roles);
              setOpen(false);
            }}
            disabled={pending}
          >
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RemoveButton({ name, onConfirm }: { name: string; onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="icon" title="إزالة من المعمل" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>إزالة {name}؟</AlertDialogTitle>
          <AlertDialogDescription>
            سيُفقد الوصول لهذا المعمل فورًا. لن يتم حذف حساب المستخدم نفسه.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>إزالة</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
