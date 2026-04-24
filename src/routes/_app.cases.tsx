import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type MouseEvent as ReactMouseEvent, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as DateCalendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Calendar, AlertTriangle, Trash2, Camera, Upload, FileBox, ImageIcon, Briefcase, Paperclip, Sparkles, ClipboardList, CalendarDays, LayoutGrid, Table as TableIcon, Eye, ArrowLeftRight, Search, XCircle, CheckCircle2, RotateCcw, Wrench } from "lucide-react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { ToothChart } from "@/components/ToothChart";
import { StageTransitionDialog } from "@/components/StageTransitionDialog";
import { ShadeSelector } from "@/components/ShadeSelector";
import { FollowupCaseDialog } from "@/components/FollowupCaseDialog";

export const Route = createFileRoute("/_app/cases")({
  component: CasesPage,
});

interface CaseItemDraft {
  id: string; // local id
  work_type_id: string;
  tooth_numbers: string;
  shade: string;
  units: string;
  unit_price: string;
}

interface PendingFileMeta {
  id: string;
  name: string;
  size: number;
  type: string;
  kind: "photo" | "scan";
  previewUrl?: string;
}

const SCAN_EXT = /\.(stl|ply|obj|zip|3mf|dcm)$/i;

function newItem(): CaseItemDraft {
  return { id: crypto.randomUUID(), work_type_id: "", tooth_numbers: "", shade: "", units: "1", unit_price: "" };
}

function formatArabicDisplayDate(value: string) {
  if (!value) return "اختر تاريخ التسليم";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

interface DueDateFieldProps {
  dueAuto: boolean;
  dueDate: string;
  predictedDate: string;
  predictedDays: number;
  baseLeadDays: number;
  extraDays: number;
  onChange: (value: string) => void;
  onResetPrediction: () => void;
}

function DueDateField({
  dueAuto,
  dueDate,
  predictedDate,
  predictedDays,
  baseLeadDays,
  extraDays,
  onChange,
  onResetPrediction,
}: DueDateFieldProps) {
  const selectedDate = dueDate ? new Date(`${dueDate}T00:00:00`) : undefined;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>تاريخ التسليم</Label>
        {dueAuto && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary">
            <Sparkles className="h-3 w-3" /> توقع تلقائي
          </span>
        )}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full justify-between rounded-lg px-3 text-start text-sm font-normal"
          >
            <span className={dueDate ? "truncate" : "truncate text-muted-foreground"}>
              {formatArabicDisplayDate(dueDate)}
            </span>
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0" dir="rtl">
          <DateCalendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              if (!date) return;
              onChange(format(date, "yyyy-MM-dd"));
            }}
          />
        </PopoverContent>
      </Popover>

      <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        محسوب من نوع العمل ({baseLeadDays} يوم) + حجم العمل (+{extraDays}) = <span className="font-semibold text-foreground">{predictedDays} يوم</span>
      </div>

      {!dueAuto && (
        <button
          type="button"
          onClick={onResetPrediction}
          className="text-[11px] font-medium text-primary hover:underline"
        >
          ↺ العودة للتوقع التلقائي ({formatArabicDisplayDate(predictedDate)})
        </button>
      )}
    </div>
  );
}

function CasesPage() {
  const { labId } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const goToCase = (caseId: string) => {
    setContextMenu(null);
    const targetPath = `/cases/${caseId}`;

    try {
      navigate({ to: "/cases/$caseId", params: { caseId } });
      window.setTimeout(() => {
        if (window.location.pathname !== targetPath) {
          window.location.assign(targetPath);
        }
      }, 120);
    } catch {
      window.location.assign(targetPath);
    }
  };
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [selectedTransition, setSelectedTransition] = useState<{ caseId: string; workflowId: string | null; currentStageId: string | null; toStageId: string } | null>(null);
  const [followup, setFollowup] = useState<{ caseId: string; caseNumber: string; type: "remake" | "repair" } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; caseData: any } | null>(null);
  const [view, setView] = useState<"table" | "kanban">("table");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [form, setForm] = useState({
    doctor_id: "",
    clinic_id: "",
    patient_name: "",
    due_date: "",
    notes: "",
  });
  const [dueAuto, setDueAuto] = useState(true); // true = auto-predicted
  const [items, setItems] = useState<CaseItemDraft[]>([newItem()]);
  const [files, setFiles] = useState<PendingFileMeta[]>([]);
  // Hold the actual File blobs in a ref keyed by metadata id.
  // Keeping File objects out of React state avoids expensive reconciliations
  // when the user types in unrelated form fields (essential at 200+ cases/day).
  const fileBlobsRef = useRef<Map<string, File>>(new Map());
  const [activeTab, setActiveTab] = useState("basic");
  const cameraRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setForm({ doctor_id: "", clinic_id: "", patient_name: "", due_date: "", notes: "" });
    setItems([newItem()]);
    files.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
    fileBlobsRef.current.clear();
    setFiles([]);
    setDueAuto(true);
    setActiveTab("basic");
  };

  const { data: nextCaseNumber } = useQuery({
    queryKey: ["next-case-number", labId, open],
    enabled: !!labId && open,
    queryFn: async () => {
      const { data } = await supabase.rpc("generate_case_number", { _lab_id: labId! });
      return data as string;
    },
  });

  const { data: stages } = useQuery({
    queryKey: ["stages", labId],
    enabled: !!labId,
    queryFn: async () => {
      const { data } = await supabase
        .from("workflow_stages")
        .select("id, name, color, order_index, is_end, estimated_days")
        .order("order_index");
      return data ?? [];
    },
  });

  const { data: cases } = useQuery({
    queryKey: ["cases", labId],
    enabled: !!labId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("*, doctors(name), patients(name), work_types(name)")
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: doctors } = useQuery({
    queryKey: ["doctors-select", labId],
    enabled: !!labId,
    queryFn: async () =>
      (await supabase
        .from("doctors")
        .select("id, name, governorate, doctor_clinics(id, name)")
        .eq("is_active", true)).data ?? [],
  });
  const selectedDoctor = doctors?.find((d: any) => d.id === form.doctor_id) as any;
  const { data: workTypes } = useQuery({
    queryKey: ["worktypes-select", labId],
    enabled: !!labId,
    queryFn: async () => (await supabase.from("work_types").select("id, name").eq("is_active", true)).data ?? [],
  });

  const updateItem = (id: string, patch: Partial<CaseItemDraft>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const resolvePrice = async (workTypeId: string) => {
    if (!labId || !workTypeId) return null;
    const { data } = await supabase.rpc("resolve_case_price", {
      _lab_id: labId,
      _work_type_id: workTypeId,
      _doctor_id: (form.doctor_id || null) as string,
    });
    return data as number | null;
  };

  const onWorkTypeChange = async (id: string, workTypeId: string) => {
    updateItem(id, { work_type_id: workTypeId });
    const price = await resolvePrice(workTypeId);
    if (price != null) updateItem(id, { unit_price: String(price) });
  };

  const addFiles = (fileList: FileList | null, defaultKind: "photo" | "scan") => {
    if (!fileList) return;
    const additions: PendingFile[] = Array.from(fileList).map((file) => {
      const isScan = SCAN_EXT.test(file.name);
      const isImg = file.type.startsWith("image/");
      const kind: "photo" | "scan" = isScan ? "scan" : isImg ? "photo" : defaultKind;
      return {
        id: crypto.randomUUID(),
        file,
        kind,
        previewUrl: isImg ? URL.createObjectURL(file) : undefined,
      };
    });
    setFiles((prev) => [...prev, ...additions]);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const f = prev.find((x) => x.id === id);
      if (f?.previewUrl) URL.revokeObjectURL(f.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
  };

  const submit = async () => {
    if (!labId || !form.doctor_id) return toast.error("اختر الطبيب");
    const validItems = items.filter((it) => it.work_type_id);
    if (!validItems.length) return toast.error("أضف نوع عمل واحد على الأقل");

    setSubmitting(true);
    try {
      // Patient
      let patientId: string | null = null;
      const trimmedName = form.patient_name.trim();
      if (trimmedName) {
        const { data: existing } = await supabase
          .from("patients")
          .select("id")
          .ilike("name", trimmedName)
          .maybeSingle();
        if (existing) patientId = existing.id;
        else {
          const { data: newP, error: pErr } = await supabase
            .from("patients")
            .insert({ lab_id: labId, name: trimmedName })
            .select("id")
            .single();
          if (pErr) throw pErr;
          patientId = newP.id;
        }
      }

      const { data: caseNum } = await supabase.rpc("generate_case_number", { _lab_id: labId });
      const { data: wf } = await supabase.from("workflows").select("id").eq("is_default", true).maybeSingle();
      const startStage = stages?.find((s) => s.order_index === 1);

      // Aggregate roll-up fields on the case (first item's work_type/shade for legacy display + sum units, concat teeth)
      const first = validItems[0];
      const allTeeth = Array.from(new Set(validItems.flatMap((it) => it.tooth_numbers.split(",").map((s) => s.trim()).filter(Boolean)))).join(",");
      const totalUnits = validItems.reduce((s, it) => s + (parseInt(it.units) || 1), 0);
      const totalPrice = validItems.reduce((s, it) => {
        const u = parseInt(it.units) || 1;
        const p = parseFloat(it.unit_price) || 0;
        return s + u * p;
      }, 0);
      const allShades = Array.from(new Set(validItems.map((it) => it.shade.trim()).filter(Boolean))).join(", ");

      const { data: created, error } = await supabase
        .from("cases")
        .insert({
          lab_id: labId,
          case_number: caseNum as string,
          doctor_id: form.doctor_id,
          patient_id: patientId,
          work_type_id: first.work_type_id || null,
          workflow_id: wf?.id ?? null,
          current_stage_id: startStage?.id ?? null,
          shade: allShades || null,
          tooth_numbers: allTeeth || null,
          units: totalUnits,
          price: totalPrice || null,
          due_date: form.due_date || null,
          notes: form.notes || null,
        })
        .select()
        .single();
      if (error) throw error;

      // Insert case items
      if (created) {
        const itemRows = validItems.map((it, idx) => {
          const u = parseInt(it.units) || 1;
          const p = it.unit_price ? parseFloat(it.unit_price) : null;
          return {
            lab_id: labId,
            case_id: created.id,
            work_type_id: it.work_type_id,
            tooth_numbers: it.tooth_numbers || null,
            shade: it.shade || null,
            units: u,
            unit_price: p,
            total_price: p != null ? p * u : null,
            position: idx,
          };
        });
        const { error: itemsErr } = await supabase.from("case_items").insert(itemRows);
        if (itemsErr) throw itemsErr;

        if (startStage) {
          await supabase.from("case_stage_history").insert({
            case_id: created.id,
            lab_id: labId,
            stage_id: startStage.id,
          });
        }

        // Upload files
        for (const pf of files) {
          const safeName = pf.file.name.replace(/[^\w.\-]+/g, "_");
          const path = `${labId}/${created.id}/${pf.kind}/${Date.now()}_${safeName}`;
          const { error: upErr } = await supabase.storage.from("case-media").upload(path, pf.file, {
            contentType: pf.file.type || undefined,
            upsert: false,
          });
          if (upErr) {
            toast.error(`فشل رفع ${pf.file.name}: ${upErr.message}`);
            continue;
          }
          await supabase.from("case_attachments").insert({
            lab_id: labId,
            case_id: created.id,
            storage_path: path,
            file_name: pf.file.name,
            file_size: pf.file.size,
            mime_type: pf.file.type || null,
            kind: pf.kind,
          });
        }
      }

      toast.success(`تم تسجيل الحالة رقم ${created?.case_number ?? caseNum}`);
      setOpen(false);
      resetForm();
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["next-case-number"] });
    } catch (e: any) {
      toast.error(e.message ?? "حدث خطأ");
    } finally {
      setSubmitting(false);
    }
  };

  const moveCase = async (caseId: string, toStageId: string, workflowId: string | null, currentStageId: string | null) => {
    setContextMenu(null);
    setSelectedTransition({ caseId, workflowId, currentStageId, toStageId });
    setStageOpen(true);
  };

  const updateCaseStatus = async (caseId: string, status: "active" | "on_hold" | "delivered" | "cancelled") => {
    setContextMenu(null);
    const patch: any = { status };
    if (status === "delivered") patch.date_delivered = new Date().toISOString();
    const { error } = await supabase.from("cases").update(patch).eq("id", caseId);
    if (error) return toast.error(error.message);
    toast.success("تم التحديث");
    qc.invalidateQueries({ queryKey: ["cases"] });
  };

  const today = new Date().toISOString().slice(0, 10);

  const openCaseContextMenu = (event: ReactMouseEvent<HTMLElement>, caseData: any) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, caseData });
  };

  useEffect(() => {
    if (!contextMenu) return;

    const closeMenu = () => setContextMenu(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };

    window.addEventListener("click", closeMenu);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [contextMenu]);

  const filteredCases = useMemo(() => {
    let list = cases ?? [];
    if (stageFilter !== "all") list = list.filter((c) => c.current_stage_id === stageFilter);
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter((c: any) =>
        c.case_number?.toLowerCase().includes(s) ||
        c.doctors?.name?.toLowerCase().includes(s) ||
        c.patients?.name?.toLowerCase().includes(s) ||
        c.work_types?.name?.toLowerCase().includes(s),
      );
    }
    return list;
  }, [cases, search, stageFilter]);

  const grandTotal = items.reduce((s, it) => {
    const u = parseInt(it.units) || 0;
    const p = parseFloat(it.unit_price) || 0;
    return s + u * p;
  }, 0);

  const contextStage = contextMenu ? stages?.find((s) => s.id === contextMenu.caseData.current_stage_id) ?? null : null;
  const contextNextStage = contextStage ? stages?.find((s) => s.order_index === contextStage.order_index + 1) ?? null : null;
  const contextMenuLeft = contextMenu
    ? Math.max(8, Math.min(contextMenu.x, (typeof window !== "undefined" ? window.innerWidth : 1280) - 240))
    : 0;
  const contextMenuTop = contextMenu
    ? Math.max(8, Math.min(contextMenu.y, (typeof window !== "undefined" ? window.innerHeight : 720) - 360))
    : 0;

  // Predict due date based on workflow stages estimated_days + workload
  const baseLeadDays = (stages ?? []).reduce((s, st: any) => s + (Number(st.estimated_days) || 0), 0);
  const validItemsCount = items.filter((it) => it.work_type_id).length;
  const totalUnitsForPrediction = items.reduce((s, it) => s + (parseInt(it.units) || 0), 0);
  const extraDays = Math.max(0, validItemsCount - 1) + Math.max(0, Math.ceil((totalUnitsForPrediction - 3) / 3));
  const predictedDays = Math.max(1, baseLeadDays + extraDays);
  const predictedDate = format(addDays(new Date(), predictedDays), "yyyy-MM-dd");

  useEffect(() => {
    if (!dueAuto || !open || form.due_date === predictedDate) return;
    setForm((prev) => (prev.due_date === predictedDate ? prev : { ...prev, due_date: predictedDate }));
  }, [dueAuto, open, predictedDate, form.due_date]);

  if (location.pathname !== "/cases") {
    return <Outlet />;
  }

  return (
    <div className="space-y-4">
      <StageTransitionDialog
        open={stageOpen}
        onOpenChange={(open) => {
          setStageOpen(open);
          if (!open) setSelectedTransition(null);
        }}
        caseId={selectedTransition?.caseId ?? ""}
        workflowId={selectedTransition?.workflowId ?? null}
        currentStageId={selectedTransition?.currentStageId ?? null}
        initialToStageId={selectedTransition?.toStageId}
        onTransitioned={() => {
          qc.invalidateQueries({ queryKey: ["cases"] });
        }}
      />

      {followup && (
        <FollowupCaseDialog
          open={!!followup}
          onOpenChange={(o) => !o && setFollowup(null)}
          caseId={followup.caseId}
          caseNumber={followup.caseNumber}
          caseType={followup.type}
          onCreated={(newCaseId, options) => {
            setFollowup(null);
            if (options.withNewWork) {
              goToCase(newCaseId);
            }
          }}
        />
      )}

      {contextMenu && (
        <div
          dir="rtl"
          className="fixed z-50 w-56 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          style={{ left: contextMenuLeft, top: contextMenuTop }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={() => goToCase(contextMenu.caseData.id)}
          >
            <Eye className="ml-2 h-4 w-4" /> فتح الحالة
          </button>

          <div className="-mx-1 my-1 h-px bg-border" />

          {stages?.filter((s) => s.id !== contextMenu.caseData.current_stage_id).map((s) => (
            <button
              key={s.id}
              type="button"
              className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              onClick={() => moveCase(contextMenu.caseData.id, s.id, contextMenu.caseData.workflow_id, contextMenu.caseData.current_stage_id)}
            >
              <ArrowLeftRight className="ml-2 h-4 w-4" />
              نقل إلى: {s.name}
            </button>
          ))}

          {contextNextStage && (
            <button
              type="button"
              className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              onClick={() => moveCase(contextMenu.caseData.id, contextNextStage.id, contextMenu.caseData.workflow_id, contextMenu.caseData.current_stage_id)}
            >
              <ArrowLeftRight className="ml-2 h-4 w-4" /> المرحلة التالية: {contextNextStage.name}
            </button>
          )}

          <div className="-mx-1 my-1 h-px bg-border" />

          {contextMenu.caseData.status !== "delivered" && (
            <button
              type="button"
              className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              onClick={() => updateCaseStatus(contextMenu.caseData.id, "delivered")}
            >
              <CheckCircle2 className="ml-2 h-4 w-4 text-emerald-600" /> تم التسليم
            </button>
          )}

          {contextMenu.caseData.status !== "on_hold" && contextMenu.caseData.status !== "delivered" && (
            <button
              type="button"
              className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              onClick={() => updateCaseStatus(contextMenu.caseData.id, "on_hold")}
            >
              <AlertTriangle className="ml-2 h-4 w-4 text-amber-600" /> إيقاف مؤقت
            </button>
          )}

          {contextMenu.caseData.status === "on_hold" && (
            <button
              type="button"
              className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              onClick={() => updateCaseStatus(contextMenu.caseData.id, "active")}
            >
              <CheckCircle2 className="ml-2 h-4 w-4" /> إعادة تفعيل
            </button>
          )}

          <div className="-mx-1 my-1 h-px bg-border" />

          <button
            type="button"
            className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={() => {
              setContextMenu(null);
              setFollowup({ caseId: contextMenu.caseData.id, caseNumber: contextMenu.caseData.case_number, type: "remake" });
            }}
          >
            <RotateCcw className="ml-2 h-4 w-4 text-blue-600" /> إعادة الحالة
          </button>
          <button
            type="button"
            className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={() => {
              setContextMenu(null);
              setFollowup({ caseId: contextMenu.caseData.id, caseNumber: contextMenu.caseData.case_number, type: "repair" });
            }}
          >
            <Wrench className="ml-2 h-4 w-4 text-amber-600" /> تصليح الحالة
          </button>

          <div className="-mx-1 my-1 h-px bg-border" />

          <button
            type="button"
            className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-destructive transition-colors hover:bg-accent hover:text-destructive"
            onClick={() => {
              setContextMenu(null);
              if (confirm(`إلغاء الحالة ${contextMenu.caseData.case_number}؟`)) {
                updateCaseStatus(contextMenu.caseData.id, "cancelled");
              }
            }}
          >
            <XCircle className="ml-2 h-4 w-4" /> إلغاء الحالة
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">الحالات</h1>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="ml-1 h-4 w-4" />حالة جديدة</Button>
          </DialogTrigger>
          <DialogContent dir="rtl" className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto p-4 sm:w-full sm:p-6">
            <DialogHeader className="pb-2">
              <DialogDescription className="sr-only">
                نموذج إنشاء حالة جديدة مع بيانات الطبيب والمريض وتاريخ التسليم والعناصر والملفات.
              </DialogDescription>
              <div className="flex items-center justify-between gap-2 pe-8">
                <DialogTitle className="text-base sm:text-lg">حالة جديدة</DialogTitle>
                {nextCaseNumber && (
                  <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-1 font-mono text-xs text-primary sm:text-sm">{nextCaseNumber}</span>
                )}
              </div>
            </DialogHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid h-auto w-full grid-cols-3 gap-2 rounded-xl bg-secondary p-2">
                <TabsTrigger value="basic" className="h-11 gap-1.5 rounded-lg text-xs sm:text-sm">
                  <ClipboardList className="h-3.5 w-3.5" /> البيانات
                </TabsTrigger>
                <TabsTrigger value="items" className="h-11 gap-1.5 rounded-lg text-xs sm:text-sm">
                  <Briefcase className="h-3.5 w-3.5" /> العناصر
                  <span className="rounded-full bg-primary/15 px-1.5 text-[10px] font-bold text-primary">{items.length}</span>
                </TabsTrigger>
                <TabsTrigger value="files" className="h-11 gap-1.5 rounded-lg text-xs sm:text-sm">
                  <Paperclip className="h-3.5 w-3.5" /> الملفات
                  {files.length > 0 && (
                    <span className="rounded-full bg-primary/15 px-1.5 text-[10px] font-bold text-primary">{files.length}</span>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: Basic info */}
              <TabsContent value="basic" className="mt-4 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label>الطبيب *</Label>
                    <Select value={form.doctor_id} onValueChange={(v) => setForm({ ...form, doctor_id: v, clinic_id: "" })}>
                      <SelectTrigger className="h-12 rounded-lg"><SelectValue placeholder="اختر طبيبًا" /></SelectTrigger>
                      <SelectContent>
                        {doctors?.map((d: any) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}{d.governorate ? ` — ${d.governorate}` : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedDoctor?.governorate && (
                      <p className="mt-1 text-xs text-muted-foreground">المحافظة: {selectedDoctor.governorate}</p>
                    )}
                  </div>
                  {selectedDoctor?.doctor_clinics?.length > 0 && (
                    <div className="sm:col-span-2">
                      <Label>العيادة</Label>
                      <Select value={form.clinic_id} onValueChange={(v) => setForm({ ...form, clinic_id: v })}>
                        <SelectTrigger className="h-12 rounded-lg"><SelectValue placeholder="اختر العيادة" /></SelectTrigger>
                        <SelectContent>
                          {selectedDoctor.doctor_clinics.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <Label>اسم المريض</Label>
                    <Input className="h-12 rounded-lg" value={form.patient_name} onChange={(e) => setForm({ ...form, patient_name: e.target.value })} placeholder="اكتب اسم المريض" />
                  </div>
                  <DueDateField
                    dueAuto={dueAuto}
                    dueDate={form.due_date}
                    predictedDate={predictedDate}
                    predictedDays={predictedDays}
                    baseLeadDays={baseLeadDays}
                    extraDays={extraDays}
                    onChange={(value) => {
                      setDueAuto(false);
                      setForm((prev) => ({ ...prev, due_date: value }));
                    }}
                    onResetPrediction={() => {
                      setDueAuto(true);
                      setForm((prev) => ({ ...prev, due_date: predictedDate }));
                    }}
                  />
                </div>
                <div>
                  <Label>ملاحظات</Label>
                  <Textarea className="min-h-28 rounded-lg" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
                </div>
                <div className="flex justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => setActiveTab("items")}>
                    التالي: العناصر ←
                  </Button>
                </div>
              </TabsContent>

              {/* TAB 2: Items */}
              <TabsContent value="items" className="mt-4">
                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">عناصر العمل</h3>
                    <Button type="button" size="sm" variant="outline" onClick={() => setItems((p) => [...p, newItem()])}>
                      <Plus className="ml-1 h-3.5 w-3.5" /> إضافة عنصر
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {items.map((it, idx) => {
                      const lineTotal = (parseInt(it.units) || 0) * (parseFloat(it.unit_price) || 0);
                      return (
                        <div key={it.id} className="rounded-md border bg-background p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-xs font-semibold text-muted-foreground">عنصر #{idx + 1}</span>
                            {items.length > 1 && (
                              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setItems((p) => p.filter((x) => x.id !== it.id))}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                              <Label className="text-xs">نوع العمل *</Label>
                              <Select value={it.work_type_id} onValueChange={(v) => onWorkTypeChange(it.id, v)}>
                                <SelectTrigger><SelectValue placeholder="اختر النوع" /></SelectTrigger>
                                <SelectContent>{workTypes?.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div className="sm:col-span-2">
                              <Label className="text-xs">اللون (يمكن اختيار أكثر من لون)</Label>
                              <ShadeSelector value={it.shade} onChange={(v) => updateItem(it.id, { shade: v })} />
                            </div>
                            <div>
                              <Label className="text-xs">الوحدات (تلقائي حسب الأسنان)</Label>
                              <Input type="number" min="1" value={it.units} readOnly className="bg-muted/50" />
                            </div>
                            <div className="sm:col-span-2">
                              <Label className="text-xs">الأسنان (خاصة بهذا العنصر)</Label>
                              <ToothChart
                                value={it.tooth_numbers}
                                onChange={(v) => {
                                  const count = v.split(",").map((s) => s.trim()).filter(Boolean).length;
                                  updateItem(it.id, { tooth_numbers: v, units: String(Math.max(count, 1)) });
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-3 flex justify-between">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setActiveTab("basic")}>→ السابق</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setActiveTab("files")}>التالي: الملفات ←</Button>
                </div>
              </TabsContent>

              {/* TAB 3: Files */}
              <TabsContent value="files" className="mt-4">
                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">صور وملفات الإسكان</h3>
                    <div className="flex flex-wrap gap-2">
                      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden
                        onChange={(e) => { addFiles(e.target.files, "photo"); e.target.value = ""; }} />
                      <input ref={photoRef} type="file" accept="image/*" multiple hidden
                        onChange={(e) => { addFiles(e.target.files, "photo"); e.target.value = ""; }} />
                      <input ref={scanRef} type="file" accept=".stl,.ply,.obj,.zip,.3mf,.dcm" multiple hidden
                        onChange={(e) => { addFiles(e.target.files, "scan"); e.target.value = ""; }} />
                      <Button type="button" size="sm" variant="outline" onClick={() => cameraRef.current?.click()}>
                        <Camera className="ml-1 h-3.5 w-3.5" /> كاميرا
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => photoRef.current?.click()}>
                        <ImageIcon className="ml-1 h-3.5 w-3.5" /> صور
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => scanRef.current?.click()}>
                        <FileBox className="ml-1 h-3.5 w-3.5" /> إسكان
                      </Button>
                    </div>
                  </div>
                  {files.length === 0 ? (
                    <p className="py-3 text-center text-xs text-muted-foreground">لم يتم إضافة ملفات بعد</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {files.map((f) => (
                        <div key={f.id} className="group relative overflow-hidden rounded-md border bg-background">
                          {f.previewUrl ? (
                            <img src={f.previewUrl} alt={f.file.name} className="h-24 w-full object-cover" />
                          ) : (
                            <div className="flex h-24 flex-col items-center justify-center gap-1 bg-muted/40 p-2 text-center">
                              <FileBox className="h-6 w-6 text-muted-foreground" />
                              <span className="line-clamp-1 text-[10px] text-muted-foreground" dir="ltr">{f.file.name}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-1 p-1.5">
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${f.kind === "scan" ? "bg-blue-500/10 text-blue-700" : "bg-emerald-500/10 text-emerald-700"}`}>
                              {f.kind === "scan" ? "إسكان" : "صورة"}
                            </span>
                            <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeFile(f.id)}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="mt-3 flex justify-start">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setActiveTab("items")}>→ السابق</Button>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-4 border-t pt-3">
              <Button type="button" variant="ghost" onClick={() => { setOpen(false); resetForm(); }} className="sm:min-w-24">
                إلغاء
              </Button>
              <Button onClick={submit} disabled={submitting} className="sm:min-w-32">
                {submitting ? (
                  <><Upload className="me-1 h-4 w-4 animate-pulse" /> جاري الحفظ...</>
                ) : "حفظ الحالة"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Toolbar: search + filter + view toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="بحث برقم الحالة، الطبيب، المريض، نوع العمل..."
            className="pr-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="كل المراحل" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المراحل</SelectItem>
            {stages?.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filteredCases.length} حالة</span>
        <div className="ms-auto flex gap-1 rounded-md border p-0.5">
          <Button size="sm" variant={view === "table" ? "default" : "ghost"} onClick={() => setView("table")} className="h-8">
            <TableIcon className="ml-1 h-3.5 w-3.5" /> جدول
          </Button>
          <Button size="sm" variant={view === "kanban" ? "default" : "ghost"} onClick={() => setView("kanban")} className="h-8">
            <LayoutGrid className="ml-1 h-3.5 w-3.5" /> بطاقات
          </Button>
        </div>
      </div>

      {view === "table" ? (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">رقم الحالة</TableHead>
                <TableHead>الطبيب</TableHead>
                <TableHead>المريض</TableHead>
                <TableHead>نوع العمل</TableHead>
                <TableHead>المرحلة</TableHead>
                <TableHead className="text-center">الوحدات</TableHead>
                <TableHead>تاريخ الاستلام</TableHead>
                <TableHead>تاريخ التسليم</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCases.map((c: any) => {
                const overdue = c.due_date && c.due_date < today && c.status === "active";
                const stage = stages?.find((s) => s.id === c.current_stage_id);
                return (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onDoubleClick={() => goToCase(c.id)}
                    onContextMenu={(event) => openCaseContextMenu(event, c)}
                  >
                    <TableCell className="font-mono text-xs">
                      <button
                        type="button"
                        className="flex items-center gap-1 text-start transition-colors hover:text-primary"
                        onClick={() => goToCase(c.id)}
                      >
                        {overdue && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                        {c.case_number}
                      </button>
                    </TableCell>
                    <TableCell>{c.doctors?.name ?? "—"}</TableCell>
                    <TableCell>{c.patients?.name ?? "—"}</TableCell>
                    <TableCell className="text-xs">{c.work_types?.name ?? "—"}</TableCell>
                    <TableCell>
                      {stage ? (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{ backgroundColor: `${stage.color}20`, color: stage.color }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: stage.color }} />
                          {stage.name}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs">{c.units ?? 0}</TableCell>
                    <TableCell className="text-xs">
                      {c.date_received ? format(new Date(c.date_received), "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell className={`text-xs ${overdue ? "text-destructive font-semibold" : ""}`}>
                      {c.due_date ? format(new Date(c.due_date), "dd/MM/yyyy") : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!filteredCases.length && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    لا توجد حالات
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <p className="border-t bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground">
            💡 اضغط بالزر الأيمن على أي حالة لعرض القائمة السريعة
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {stages?.map((stage) => {
            const stageCases = filteredCases.filter((c) => c.current_stage_id === stage.id) ?? [];
            return (
              <div key={stage.id} className="rounded-lg border bg-card p-3">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: stage.color }} />
                    <span className="font-semibold">{stage.name}</span>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{stageCases.length}</span>
                </div>
                <div className="space-y-2">
                  {stageCases.map((c) => {
                    const overdue = c.due_date && c.due_date < today && c.status === "active";
                    const nextStage = stages?.find((s) => s.order_index === stage.order_index + 1);
                    return (
                      <Card
                        key={c.id}
                        className="cursor-pointer transition-colors hover:border-primary"
                        onContextMenu={(event) => openCaseContextMenu(event, c)}
                      >
                        <CardContent className="p-3 text-sm">
                          <button
                            type="button"
                            onClick={() => goToCase(c.id)}
                            className="block w-full text-right"
                          >
                            <div className="mb-1 flex items-center justify-between">
                              <span className="font-mono text-xs text-muted-foreground">{c.case_number}</span>
                              {overdue && <AlertTriangle className="h-4 w-4 text-destructive" />}
                            </div>
                            <p className="font-medium">{(c as any).doctors?.name ?? "—"}</p>
                            <p className="text-xs text-muted-foreground">{(c as any).patients?.name ?? "—"}</p>
                            {(c as any).work_types?.name && <p className="mt-1 text-xs">{(c as any).work_types.name}</p>}
                            {c.due_date && (
                              <p className={`mt-1 flex items-center gap-1 text-xs ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                                <Calendar className="h-3 w-3" />
                                {format(new Date(c.due_date), "dd/MM/yyyy")}
                              </p>
                            )}
                          </button>
                          {nextStage && !stage.is_end && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-2 w-full text-xs"
                              onClick={() => moveCase(c.id, nextStage.id, c.workflow_id, c.current_stage_id)}
                            >
                              ← {nextStage.name}
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                  {!stageCases.length && <p className="py-4 text-center text-xs text-muted-foreground">فارغ</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
