import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Star,
  StarOff,
  Workflow as WorkflowIcon,
  Lock,
  Bell,
  Clock,
} from "lucide-react";

export const Route = createFileRoute("/_app/workflows")({
  component: WorkflowsPage,
});

type Stage = {
  id: string;
  workflow_id: string;
  name: string;
  code: string;
  color: string;
  order_index: number;
  estimated_days: number | null;
  notify_doctor: boolean;
  is_start: boolean;
  is_end: boolean;
};

type Workflow = {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  stages: Stage[];
};

const PALETTE = [
  "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444", "#F97316",
  "#DC2626", "#06B6D4", "#059669", "#10B981", "#EC4899",
  "#6366F1", "#14B8A6", "#84CC16", "#A855F7", "#6B7280",
];

function WorkflowsPage() {
  const { labId } = useAuth();
  const qc = useQueryClient();
  const [newWfOpen, setNewWfOpen] = useState(false);
  const [newWfName, setNewWfName] = useState("");
  const [newWfDesc, setNewWfDesc] = useState("");

  const { data: workflows, isLoading } = useQuery({
    queryKey: ["workflows-full", labId],
    enabled: !!labId,
    queryFn: async () => {
      const { data: wfs } = await supabase
        .from("workflows")
        .select("*")
        .order("created_at");
      const { data: stages } = await supabase
        .from("workflow_stages")
        .select("*")
        .order("order_index");
      return (wfs ?? []).map((w) => ({
        ...w,
        stages: (stages ?? []).filter((s) => s.workflow_id === w.id),
      })) as Workflow[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["workflows-full", labId] });

  const createWorkflow = async () => {
    if (!newWfName.trim()) return toast.error("اسم سير العمل مطلوب");
    const { error } = await supabase.rpc("create_workflow", {
      _name: newWfName.trim(),
      _description: newWfDesc.trim() || undefined,
    });
    if (error) return toast.error(error.message);
    toast.success("تم إنشاء سير العمل");
    setNewWfOpen(false);
    setNewWfName("");
    setNewWfDesc("");
    refresh();
  };

  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <WorkflowIcon className="h-6 w-6 text-primary" /> سير العمل
          </h1>
          <p className="text-sm text-muted-foreground">
            خصّص مراحل الإنتاج لمعملك — أضف، عدّل، أعد الترتيب أو احذف.
          </p>
        </div>
        <Dialog open={newWfOpen} onOpenChange={setNewWfOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="ml-1 h-4 w-4" /> سير عمل جديد
            </Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>إنشاء سير عمل جديد</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>الاسم *</Label>
                <Input
                  value={newWfName}
                  onChange={(e) => setNewWfName(e.target.value)}
                  placeholder="مثال: زيركون / متحرك"
                />
              </div>
              <div>
                <Label>الوصف</Label>
                <Textarea
                  value={newWfDesc}
                  onChange={(e) => setNewWfDesc(e.target.value)}
                  rows={2}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                سيتم إنشاء مرحلتي «استلام» و «تم التسليم» تلقائيًا، ثم تضيف ما تريد بينهما.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={createWorkflow}>إنشاء</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>}

      {workflows?.map((wf) => (
        <WorkflowCard key={wf.id} wf={wf} onChanged={refresh} />
      ))}

      {!isLoading && !workflows?.length && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            لا يوجد سير عمل بعد.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function WorkflowCard({ wf, onChanged }: { wf: Workflow; onChanged: () => void }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editStage, setEditStage] = useState<Stage | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [name, setName] = useState(wf.name);
  const [desc, setDesc] = useState(wf.description ?? "");

  const sorted = [...wf.stages].sort((a, b) => a.order_index - b.order_index);

  const setDefault = async () => {
    const { error } = await supabase.rpc("set_default_workflow", { _workflow_id: wf.id });
    if (error) return toast.error(error.message);
    toast.success("تم التعيين كافتراضي");
    onChanged();
  };

  const remove = async (force = false) => {
    const { error } = await supabase.rpc("delete_workflow", {
      _workflow_id: wf.id,
      _force: force,
    });
    if (error) {
      if (error.message.includes("حالة مرتبطة")) {
        const ok = window.confirm(error.message + "\n\nهل تريد نقل الحالات لسير العمل الافتراضي والمتابعة؟");
        if (ok) return remove(true);
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success("تم الحذف");
    setConfirmDelete(false);
    onChanged();
  };

  const saveRename = async () => {
    const { error } = await supabase.rpc("update_workflow", {
      _workflow_id: wf.id,
      _name: name,
      _description: desc || undefined,
    });
    if (error) return toast.error(error.message);
    toast.success("تم الحفظ");
    setRenameOpen(false);
    onChanged();
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= sorted.length) return;
    const arr = [...sorted];
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    const { error } = await supabase.rpc("reorder_workflow_stages", {
      _workflow_id: wf.id,
      _ordered_stage_ids: arr.map((s) => s.id),
    });
    if (error) return toast.error(error.message);
    onChanged();
  };

  const removeStage = async (id: string) => {
    if (!window.confirm("حذف هذه المرحلة؟")) return;
    const { error } = await supabase.rpc("delete_workflow_stage", { _stage_id: id });
    if (error) return toast.error(error.message);
    toast.success("تم الحذف");
    onChanged();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            {wf.name}
            {wf.is_default && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                <Star className="h-3 w-3" /> افتراضي
              </span>
            )}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-1">
            {!wf.is_default && (
              <Button size="sm" variant="ghost" onClick={setDefault} title="جعله الافتراضي">
                <StarOff className="ml-1 h-4 w-4" /> تعيين كافتراضي
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setName(wf.name);
                setDesc(wf.description ?? "");
                setRenameOpen(true);
              }}
            >
              <Pencil className="ml-1 h-4 w-4" /> تعديل
            </Button>
            {!wf.is_default && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="ml-1 h-4 w-4" /> حذف
              </Button>
            )}
          </div>
        </div>
        {wf.description && <p className="text-xs text-muted-foreground">{wf.description}</p>}
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {sorted.map((s, i) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2"
              style={{ borderInlineStartColor: s.color, borderInlineStartWidth: 4 }}
            >
              <div className="flex w-7 shrink-0 flex-col items-center">
                <button
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  title="لأعلى"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <span className="text-[10px] text-muted-foreground">{s.order_index}</span>
                <button
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={i === sorted.length - 1}
                  onClick={() => move(i, 1)}
                  title="لأسفل"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              </div>
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{s.name}</span>
                  {s.is_start && (
                    <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-600 dark:text-blue-400">
                      بداية
                    </span>
                  )}
                  {s.is_end && (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                      نهاية
                    </span>
                  )}
                  {s.notify_doctor && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                      <Bell className="h-3 w-3" /> إشعار طبيب
                    </span>
                  )}
                  {s.estimated_days != null && s.estimated_days > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" /> {s.estimated_days} يوم
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditStage(s)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                {s.is_start || s.is_end ? (
                  <Button size="sm" variant="ghost" disabled title="مرحلة محمية">
                    <Lock className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => removeStage(s.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}

          <Button variant="outline" size="sm" className="w-full" onClick={() => setAddOpen(true)}>
            <Plus className="ml-1 h-4 w-4" /> إضافة مرحلة
          </Button>
        </div>
      </CardContent>

      <StageDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        workflowId={wf.id}
        onDone={onChanged}
      />
      <StageDialog
        open={!!editStage}
        onOpenChange={(v) => !v && setEditStage(null)}
        workflowId={wf.id}
        stage={editStage ?? undefined}
        onDone={() => {
          setEditStage(null);
          onChanged();
        }}
      />

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل سير العمل</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>الاسم</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>الوصف</Label>
              <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveRename}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف سير العمل؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف «{wf.name}» ومراحله. الحالات المرتبطة (إن وجدت) سيتم نقلها إلى سير العمل الافتراضي.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove(false)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function StageDialog({
  open,
  onOpenChange,
  workflowId,
  stage,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workflowId: string;
  stage?: Stage;
  onDone: () => void;
}) {
  const [name, setName] = useState(stage?.name ?? "");
  const [color, setColor] = useState(stage?.color ?? "#6B7280");
  const [days, setDays] = useState<number>(stage?.estimated_days ?? 0);
  const [notify, setNotify] = useState<boolean>(stage?.notify_doctor ?? false);
  const [saving, setSaving] = useState(false);

  // Reset when dialog opens with different stage
  useState(() => {
    setName(stage?.name ?? "");
    setColor(stage?.color ?? "#6B7280");
    setDays(stage?.estimated_days ?? 0);
    setNotify(stage?.notify_doctor ?? false);
  });

  const submit = async () => {
    if (!name.trim()) return toast.error("الاسم مطلوب");
    setSaving(true);
    const { error } = stage
      ? await supabase.rpc("update_workflow_stage", {
          _stage_id: stage.id,
          _name: name.trim(),
          _color: color,
          _estimated_days: days,
          _notify_doctor: notify,
        })
      : await supabase.rpc("add_workflow_stage", {
          _workflow_id: workflowId,
          _name: name.trim(),
          _color: color,
          _estimated_days: days,
          _notify_doctor: notify,
        });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(stage ? "تم التحديث" : "تمت الإضافة");
    onDone();
    onOpenChange(false);
    if (!stage) {
      setName("");
      setColor("#6B7280");
      setDays(0);
      setNotify(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) {
          setName(stage?.name ?? "");
          setColor(stage?.color ?? "#6B7280");
          setDays(stage?.estimated_days ?? 0);
          setNotify(stage?.notify_doctor ?? false);
        }
      }}
    >
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>{stage ? "تعديل مرحلة" : "إضافة مرحلة"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>اسم المرحلة *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: تشطيب نهائي" />
          </div>
          <div>
            <Label>اللون</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? "hsl(var(--foreground))" : "transparent",
                  }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
          <div>
            <Label>الأيام المتوقعة</Label>
            <Input
              type="number"
              min={0}
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value || "0", 10))}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-2">
            <div>
              <Label className="cursor-pointer">إشعار الطبيب عند الوصول لهذه المرحلة</Label>
              <p className="text-xs text-muted-foreground">يظهر في بورتال الطبيب</p>
            </div>
            <Switch checked={notify} onCheckedChange={setNotify} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving}>
            {saving ? "جارٍ..." : stage ? "حفظ" : "إضافة"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
