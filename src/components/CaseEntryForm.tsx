/**
 * CaseEntryForm — Professional, high-volume case entry screen.
 *
 * Inspired by industry leaders (LabStar, Magic Touch, Evident):
 * - Two-column responsive layout (mobile: single column, sticky bottom bar)
 * - Sticky header (case number + actions) and sticky action bar
 * - Auto-save draft to localStorage (recovery on accidental close)
 * - Smart Defaults (remembers last doctor/work-type/shade)
 * - Inline Quick-Create for patient (typed name auto-creates)
 * - Keyboard shortcuts: Ctrl+S = save, Ctrl+Enter = save+new, Esc = back
 * - Three save actions: Save / Save + New / Save + Print (thermal slip)
 * - Performance: file blobs kept in ref, FileGrid memoized,
 *   parallel uploads with concurrency cap
 */
import {
  type ChangeEvent,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format, addDays } from "date-fns";
import {
  ArrowRight,
  Briefcase,
  Calendar as CalendarIcon,
  Camera,
  Check,
  ChevronsUpDown,
  FileBox,
  ImageIcon,
  Keyboard,
  Paperclip,
  Plus,
  Printer,
  Save,
  Sparkles,
  Trash2,
  Upload,
  User,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Calendar as DateCalendar } from "@/components/ui/calendar";
import { ToothChart } from "@/components/ToothChart";
import { ShadeSelector } from "@/components/ShadeSelector";
import { InlineCameraDialog } from "@/components/InlineCameraDialog";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface CaseEntryItem {
  id: string;
  work_type_id: string;
  tooth_numbers: string;
  shade: string;
  units: string;
  unit_price: string;
}

export interface PendingFileMeta {
  id: string;
  name: string;
  size: number;
  type: string;
  kind: "photo" | "scan";
  previewUrl?: string;
}

export interface DoctorOption {
  id: string;
  name: string;
  governorate?: string | null;
  doctor_clinics?: { id: string; name: string }[];
}

export interface WorkTypeOption {
  id: string;
  name: string;
}

export type CaseEntryMode = "admin" | "portal";

interface CaseEntryFormProps {
  mode: CaseEntryMode;
  labId: string;
  /** Pre-bound doctor (used by portal so the picker is hidden) */
  fixedDoctorId?: string;
  /** Where to navigate after a successful single-save */
  onSaved?: (caseId: string, caseNumber: string) => void;
  /** Cancel/back action */
  onCancel?: () => void;
}

const SCAN_EXT = /\.(stl|ply|obj|zip|3mf|dcm)$/i;
const DRAFT_KEY_BASE = "lovable.case-entry.draft.v2";
function makeDraftKey(mode: string, fixedDoctorId?: string) {
  return `${DRAFT_KEY_BASE}.${mode}${fixedDoctorId ? `.${fixedDoctorId}` : ""}`;
}
const PREFS_KEY = "lovable.case-entry.prefs.v1";

interface DraftSnapshot {
  doctor_id: string;
  clinic_id: string;
  patient_name: string;
  due_date: string;
  notes: string;
  items: CaseEntryItem[];
  savedAt: number;
}

interface SmartDefaults {
  lastDoctorId?: string;
  lastWorkTypeId?: string;
  lastShade?: string;
}

const newItem = (_defaults?: SmartDefaults): CaseEntryItem => ({
  id: crypto.randomUUID(),
  work_type_id: "",
  tooth_numbers: "",
  shade: "",
  units: "1",
  unit_price: "",
});

const formatArabicDate = (value: string) => {
  if (!value) return "اختر تاريخ التسليم";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
};

const loadPrefs = (): SmartDefaults => {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") as SmartDefaults;
  } catch {
    return {};
  }
};

const savePrefs = (prefs: SmartDefaults) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
};

// ----------------------------------------------------------------------------
// Memoized FileGrid (re-renders only when files change, not on keystroke)
// ----------------------------------------------------------------------------

const FileGrid = memo(function FileGrid({
  files,
  onRemove,
}: {
  files: PendingFileMeta[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
      {files.map((f) => (
        <div key={f.id} className="group relative overflow-hidden rounded-md border bg-background shadow-xs">
          {f.previewUrl ? (
            <img src={f.previewUrl} alt={f.name} loading="lazy" decoding="async" className="h-24 w-full object-cover" />
          ) : (
            <div className="flex h-24 flex-col items-center justify-center gap-1 bg-muted/40 p-2 text-center">
              <FileBox className="h-6 w-6 text-muted-foreground" />
              <span className="line-clamp-2 text-[10px] text-muted-foreground" dir="ltr">
                {f.name}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between gap-1 p-1.5">
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                f.kind === "scan" ? "bg-primary/10 text-primary" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              }`}
            >
              {f.kind === "scan" ? "إسكان" : "صورة"}
            </span>
            <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => onRemove(f.id)}>
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
});

// ----------------------------------------------------------------------------
// Thermal-printer-friendly slip (80mm)
// ----------------------------------------------------------------------------

interface PrintSlipData {
  caseNumber: string;
  doctorName: string;
  patientName: string;
  workTypes: string;
  shade: string;
  units: number;
  dueDate: string;
  notes: string;
  labName?: string;
}

const printThermalSlip = (data: PrintSlipData) => {
  const win = window.open("", "_blank", "width=320,height=600");
  if (!win) {
    toast.error("افتح السماح بالنوافذ المنبثقة للطباعة");
    return;
  }
  const esc = (s: unknown) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
<title>إيصال ${esc(data.caseNumber)}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Tajawal', 'Cairo', system-ui, sans-serif; font-size: 12px; margin: 0; padding: 6px; color: #000; }
  .center { text-align: center; }
  .lab { font-size: 16px; font-weight: 800; }
  .num { font-size: 22px; font-weight: 900; letter-spacing: 1px; margin: 6px 0; padding: 6px; border: 2px dashed #000; text-align: center; }
  .row { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dashed #999; }
  .row .lbl { font-weight: 700; }
  .notes { margin-top: 6px; padding: 4px; border: 1px solid #333; font-size: 11px; }
  .foot { margin-top: 8px; text-align: center; font-size: 10px; color: #555; }
</style></head><body>
  <div class="center lab">${esc(data.labName ?? "معمل الأسنان")}</div>
  <div class="center" style="font-size:10px;color:#555">${esc(new Date().toLocaleString("ar-EG"))}</div>
  <div class="num">${esc(data.caseNumber)}</div>
  <div class="row"><span class="lbl">الطبيب:</span><span>${esc(data.doctorName || "—")}</span></div>
  <div class="row"><span class="lbl">المريض:</span><span>${esc(data.patientName || "—")}</span></div>
  <div class="row"><span class="lbl">نوع العمل:</span><span>${esc(data.workTypes || "—")}</span></div>
  <div class="row"><span class="lbl">اللون:</span><span>${esc(data.shade || "—")}</span></div>
  <div class="row"><span class="lbl">الوحدات:</span><span>${esc(data.units)}</span></div>
  <div class="row"><span class="lbl">التسليم:</span><span>${esc(data.dueDate || "—")}</span></div>
  ${data.notes ? `<div class="notes"><b>ملاحظات:</b><br/>${esc(data.notes)}</div>` : ""}
  <div class="foot">— شكراً لتعاملكم معنا —</div>
  <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300);}</script>
</body></html>`;
  win.document.write(html);
  win.document.close();
};

// ============================================================================
// Main component
// ============================================================================

export function CaseEntryForm({ mode, labId, fixedDoctorId, onSaved, onCancel }: CaseEntryFormProps) {
  const navigate = useNavigate();
  const prefs = useMemo(loadPrefs, []);
  const DRAFT_KEY = useMemo(() => makeDraftKey(mode, fixedDoctorId), [mode, fixedDoctorId]);

  // Cleanup legacy v1 draft (was shared across portal & lab — caused leakage)
  useEffect(() => {
    if (typeof window !== "undefined") {
      try { localStorage.removeItem("lovable.case-entry.draft.v1"); } catch { /* noop */ }
    }
  }, []);

  // ---------- form state ----------
  const [form, setForm] = useState({
    doctor_id: fixedDoctorId ?? "",
    clinic_id: "",
    patient_name: "",
    due_date: "",
    notes: "",
  });
  const [items, setItems] = useState<CaseEntryItem[]>([newItem()]);
  const [files, setFiles] = useState<PendingFileMeta[]>([]);
  const [dueAuto, setDueAuto] = useState(true);
  const [noDiagnosis, setNoDiagnosis] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [labName, setLabName] = useState<string | undefined>();
  const [doctorPickerOpen, setDoctorPickerOpen] = useState(false);

  const fileBlobsRef = useRef<Map<string, File>>(new Map());
  const cameraRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const scanRef = useRef<HTMLInputElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // ---------- queries ----------
  const { data: nextCaseNumber } = useQuery({
    queryKey: ["next-case-number-form", labId],
    enabled: !!labId && mode === "admin",
    queryFn: async () => {
      const { data } = await supabase.rpc("generate_case_number", { _lab_id: labId });
      return data as string;
    },
  });

  const { data: doctors } = useQuery({
    queryKey: ["doctors-entry", labId],
    enabled: !!labId && mode === "admin",
    queryFn: async () =>
      ((await supabase
        .from("doctors")
        .select("id, name, governorate, doctor_clinics(id, name)")
        .eq("is_active", true)
        .order("name")).data ?? []) as DoctorOption[],
  });

  const { data: workTypes } = useQuery({
    queryKey: ["worktypes-entry", labId],
    enabled: !!labId,
    queryFn: async () =>
      ((await supabase
        .from("work_types")
        .select("id, name")
        .eq("is_active", true)
        .order("name")).data ?? []) as WorkTypeOption[],
  });

  const { data: stages } = useQuery({
    queryKey: ["stages-entry", labId],
    enabled: !!labId,
    queryFn: async () =>
      ((await supabase
        .from("workflow_stages")
        .select("id, order_index, estimated_days")
        .order("order_index")).data ?? []),
  });

  useEffect(() => {
    if (!labId) return;
    supabase.from("labs").select("name").eq("id", labId).maybeSingle().then(({ data }) => {
      if (data?.name) setLabName(data.name);
    });
  }, [labId]);

  // ---------- draft auto-save (DISABLED by user request) ----------
  // Clear any previously stored draft so it never gets restored.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
  }, [DRAFT_KEY]);

  // ---------- predicted due date ----------
  const baseLeadDays = (stages ?? []).reduce((s: number, st: { estimated_days: number | null }) => s + (Number(st.estimated_days) || 0), 0) || 5;
  const validItemsCount = items.filter((it) => it.work_type_id).length;
  const totalUnitsForPrediction = items.reduce((s, it) => s + (parseInt(it.units) || 0), 0);
  const extraDays = Math.max(0, validItemsCount - 1) + Math.max(0, Math.ceil((totalUnitsForPrediction - 3) / 3));
  const predictedDays = Math.max(1, baseLeadDays + extraDays);
  const predictedDate = format(addDays(new Date(), predictedDays), "yyyy-MM-dd");

  useEffect(() => {
    if (!dueAuto) return;
    setForm((prev) => (prev.due_date === predictedDate ? prev : { ...prev, due_date: predictedDate }));
  }, [dueAuto, predictedDate]);

  // ---------- handlers ----------
  const updateItem = useCallback((id: string, patch: Partial<CaseEntryItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const resolvePrice = async (workTypeId: string) => {
    if (!labId || !workTypeId || mode === "portal") return null;
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

  const addFiles = useCallback((fileList: FileList | null, defaultKind: "photo" | "scan") => {
    if (!fileList) return;
    const additions: PendingFileMeta[] = Array.from(fileList).map((file) => {
      const isScan = SCAN_EXT.test(file.name);
      const isImg = file.type.startsWith("image/");
      const kind: "photo" | "scan" = isScan ? "scan" : isImg ? "photo" : defaultKind;
      const id = crypto.randomUUID();
      fileBlobsRef.current.set(id, file);
      return {
        id,
        name: file.name,
        size: file.size,
        type: file.type,
        kind,
        previewUrl: isImg ? URL.createObjectURL(file) : undefined,
      };
    });
    setFiles((prev) => [...prev, ...additions]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const f = prev.find((x) => x.id === id);
      if (f?.previewUrl) URL.revokeObjectURL(f.previewUrl);
      fileBlobsRef.current.delete(id);
      return prev.filter((x) => x.id !== id);
    });
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      addFiles(e.dataTransfer.files, "photo");
    },
    [addFiles],
  );

  const resetForm = useCallback(
    (preserveDoctor = false) => {
      const keepDoctorId = preserveDoctor ? form.doctor_id : fixedDoctorId ?? "";
      const keepClinicId = preserveDoctor ? form.clinic_id : "";
      setForm({
        doctor_id: keepDoctorId,
        clinic_id: keepClinicId,
        patient_name: "",
        due_date: "",
        notes: "",
      });
      setItems([newItem(loadPrefs())]);
      files.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
      fileBlobsRef.current.clear();
      setFiles([]);
      setDueAuto(true);
      setDraftRestored(false);
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      // Refocus first field for rapid re-entry
      window.setTimeout(() => firstFieldRef.current?.focus(), 50);
    },
    [files, form.doctor_id, form.clinic_id, fixedDoctorId],
  );

  // ---------- submit ----------
  type SubmitMode = "save" | "save_new" | "save_print";

  const submit = async (submitMode: SubmitMode) => {
    if (!labId) return toast.error("معرّف المعمل غير متوفر");
    if (!form.doctor_id) return toast.error("اختر الطبيب");
    const validItems = items.filter((it) => it.work_type_id);
    if (!validItems.length && !noDiagnosis) {
      return toast.error("أضف نوع عمل أو فعّل خيار «بدون تشخيص»");
    }

    setSubmitting(true);
    try {
      const isPortal = mode === "portal";

      // Patient upsert (lab members only — doctors can't write to patients table via RLS).
      // For portal submissions, the patient name is preserved in the case notes instead.
      let patientId: string | null = null;
      const trimmedName = form.patient_name.trim();
      if (trimmedName && !isPortal) {
        const { data: existing } = await supabase
          .from("patients")
          .select("id")
          .eq("lab_id", labId)
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

      const { data: caseNum } = isPortal
        ? { data: `PND-${Date.now()}` }
        : await supabase.rpc("generate_case_number", { _lab_id: labId });

      const { data: wf } = isPortal
        ? { data: null }
        : await supabase.from("workflows").select("id").eq("is_default", true).maybeSingle();

      const startStage = isPortal ? null : ((stages ?? []).find((s: { order_index: number }) => s.order_index === 1) as { id: string } | undefined);

      const first = validItems[0];
      const allTeeth = Array.from(
        new Set(validItems.flatMap((it) => it.tooth_numbers.split(",").map((s) => s.trim()).filter(Boolean))),
      ).join(",");
      const totalUnits = validItems.reduce((s, it) => s + (parseInt(it.units) || 1), 0);
      const totalPrice = validItems.reduce((s, it) => {
        const u = parseInt(it.units) || 1;
        const p = parseFloat(it.unit_price) || 0;
        return s + u * p;
      }, 0);
      const allShades = Array.from(new Set(validItems.map((it) => it.shade.trim()).filter(Boolean))).join(", ");

      const noDxMarker = "[بدون تشخيص — يحتاج إكمال البيانات]";
      const baseNotes = isPortal && trimmedName
        ? `المريض: ${trimmedName}${form.notes ? `\n${form.notes}` : ""}`
        : form.notes || null;
      const finalNotes = noDiagnosis
        ? `${noDxMarker}${baseNotes ? `\n${baseNotes}` : ""}`
        : baseNotes;

      const { data: created, error } = await supabase
        .from("cases")
        .insert({
          lab_id: labId,
          case_number: caseNum as string,
          doctor_id: form.doctor_id,
          patient_id: patientId,
          work_type_id: first?.work_type_id || null,
          workflow_id: wf?.id ?? null,
          current_stage_id: startStage?.id ?? null,
          shade: allShades || null,
          tooth_numbers: allTeeth || null,
          units: totalUnits || 1,
          price: totalPrice || null,
          due_date: form.due_date || null,
          notes: finalNotes,
          status: isPortal ? "pending_approval" : "active",
        })
        .select()
        .single();
      if (error) throw error;

      if (created) {
        // Items
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

        // Parallel uploads (4 at a time)
        const CONCURRENCY = 4;
        const uploadOne = async (pf: PendingFileMeta) => {
          const blob = fileBlobsRef.current.get(pf.id);
          if (!blob) return;
          const safeName = pf.name.replace(/[^\w.\-]+/g, "_");
          const bucket = isPortal ? "case-attachments" : "case-media";
          const path = isPortal
            ? `${labId}/${created.id}/${Date.now()}_${safeName}`
            : `${labId}/${created.id}/${pf.kind}/${Date.now()}_${safeName}`;
          const { error: upErr } = await supabase.storage.from(bucket).upload(path, blob, {
            contentType: pf.type || undefined,
            upsert: false,
          });
          if (upErr) {
            toast.error(`فشل رفع ${pf.name}: ${upErr.message}`);
            return;
          }
          await supabase.from("case_attachments").insert({
            lab_id: labId,
            case_id: created.id,
            storage_path: path,
            file_name: pf.name,
            file_size: pf.size,
            mime_type: pf.type || null,
            kind: pf.kind,
          });
        };
        for (let i = 0; i < files.length; i += CONCURRENCY) {
          await Promise.all(files.slice(i, i + CONCURRENCY).map(uploadOne));
        }
      }

      // Save smart defaults
      if (validItems.length) {
        savePrefs({
          lastDoctorId: form.doctor_id,
          lastWorkTypeId: validItems[0].work_type_id,
          lastShade: validItems[0].shade,
        });
      }

      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }

      const successMsg = isPortal
        ? "تم رفع الحالة بنجاح، بانتظار موافقة المعمل"
        : `تم تسجيل الحالة رقم ${created.case_number}`;

      // Print before navigation
      if (submitMode === "save_print") {
        const doctorName = doctors?.find((d) => d.id === form.doctor_id)?.name ?? "";
        const workTypeNames = validItems
          .map((it) => workTypes?.find((w) => w.id === it.work_type_id)?.name ?? "")
          .filter(Boolean)
          .join(" + ");
        printThermalSlip({
          caseNumber: created.case_number,
          doctorName,
          patientName: form.patient_name,
          workTypes: workTypeNames || "بدون تشخيص",
          shade: allShades,
          units: totalUnits,
          dueDate: form.due_date,
          notes: form.notes,
          labName,
        });
      }

      toast.success(successMsg);
      if (noDiagnosis) {
        toast.warning("تذكير: هذه الحالة بدون تشخيص — لا تنسَ إضافة نوع العمل والأسنان لاحقًا", { duration: 6000 });
      }

      if (submitMode === "save_new") {
        resetForm(true); // keep doctor for bulk entry
      } else {
        if (onSaved) onSaved(created.id, created.case_number);
        else if (mode === "admin") navigate({ to: "/cases" });
        else navigate({ to: "/portal/cases" });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "حدث خطأ أثناء الحفظ";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- keyboard shortcuts ----------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement && e.key !== "s" && !(e.ctrlKey || e.metaKey)) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === "s") {
        e.preventDefault();
        submit("save");
      } else if (ctrl && e.key === "Enter") {
        e.preventDefault();
        submit("save_new");
      } else if (ctrl && e.key === "p") {
        e.preventDefault();
        submit("save_print");
      } else if (e.key === "Escape" && !submitting) {
        if (onCancel) onCancel();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, items, files, submitting]);

  // Auto-focus first field on mount
  useEffect(() => {
    window.setTimeout(() => firstFieldRef.current?.focus(), 100);
  }, []);

  // ---------- derived ----------
  const selectedDoctor = doctors?.find((d) => d.id === form.doctor_id);
  const grandTotal = items.reduce((s, it) => {
    const u = parseInt(it.units) || 0;
    const p = parseFloat(it.unit_price) || 0;
    return s + u * p;
  }, 0);
  const totalUnits = items.reduce((s, it) => s + (parseInt(it.units) || 0), 0);
  const itemsValid = items.filter((it) => it.work_type_id).length > 0;
  const canSubmit = !!form.doctor_id && (itemsValid || noDiagnosis) && !submitting;

  // ---------- UI ----------
  return (
    <div className="flex h-full min-h-screen flex-col bg-background">
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur-md shadow-xs">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            {onCancel && (
              <Button variant="ghost" size="icon" onClick={onCancel} className="h-9 w-9 shrink-0" title="رجوع (Esc)">
                <ArrowRight className="h-5 w-5" />
              </Button>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold sm:text-lg">حالة جديدة</h1>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">
                {form.patient_name || "بدون اسم مريض"}
                {selectedDoctor && ` · ${selectedDoctor.name}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {nextCaseNumber && mode === "admin" && (
              <span className="hidden rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 font-mono text-xs font-bold text-primary sm:inline-block">
                {nextCaseNumber}
              </span>
            )}
            {/* Desktop save buttons */}
            <div className="hidden items-center gap-1.5 md:flex">
              {mode === "admin" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => submit("save_print")}
                  disabled={!canSubmit}
                  title="حفظ + طباعة (Ctrl+P)"
                >
                  <Printer className="ml-1.5 h-4 w-4" /> حفظ وطباعة
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => submit("save_new")}
                disabled={!canSubmit}
                title="حفظ + حالة جديدة (Ctrl+Enter)"
              >
                <Zap className="ml-1.5 h-4 w-4" /> حفظ + جديد
              </Button>
              <Button size="sm" onClick={() => submit("save")} disabled={!canSubmit} title="حفظ (Ctrl+S)">
                {submitting ? (
                  <>
                    <Upload className="ml-1.5 h-4 w-4 animate-pulse" /> جاري الحفظ
                  </>
                ) : (
                  <>
                    <Save className="ml-1.5 h-4 w-4" /> حفظ
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Body — two-column responsive grid */}
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-4 pb-32 md:pb-6">
        <div className="grid gap-4 lg:grid-cols-12">
          {/* LEFT — Patient & Meta */}
          <section className="space-y-4 lg:col-span-5">
            <div className="rounded-xl border bg-card p-4 shadow-xs">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-muted-foreground">
                <User className="h-4 w-4" /> بيانات أساسية
              </h2>
              <div className="space-y-3">
                {mode === "admin" && (
                  <div>
                    <Label className="mb-1.5 block text-xs font-semibold">
                      الطبيب <span className="text-destructive">*</span>
                    </Label>
                    <Popover open={doctorPickerOpen} onOpenChange={setDoctorPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={doctorPickerOpen}
                          className={cn(
                            "h-11 w-full justify-between rounded-lg font-normal",
                            !selectedDoctor && "text-muted-foreground",
                          )}
                        >
                          {selectedDoctor
                            ? `${selectedDoctor.name}${selectedDoctor.governorate ? ` — ${selectedDoctor.governorate}` : ""}`
                            : "ابحث عن طبيب..."}
                          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[--radix-popover-trigger-width] min-w-[280px] p-0"
                        align="start"
                      >
                        <Command
                          filter={(value, search) => {
                            // value here is the searchValue we set on CommandItem
                            const v = value.toLowerCase();
                            const s = search.toLowerCase().trim();
                            if (!s) return 1;
                            return v.includes(s) ? 1 : 0;
                          }}
                        >
                          <CommandInput placeholder="ابحث بالاسم أو المحافظة..." className="h-10" />
                          <CommandList>
                            <CommandEmpty>لا يوجد نتائج</CommandEmpty>
                            <CommandGroup>
                              {doctors?.map((d) => {
                                const searchValue = `${d.name} ${d.governorate ?? ""}`.trim();
                                return (
                                  <CommandItem
                                    key={d.id}
                                    value={searchValue}
                                    onSelect={() => {
                                      setForm({ ...form, doctor_id: d.id, clinic_id: "" });
                                      setDoctorPickerOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "ml-2 h-4 w-4",
                                        form.doctor_id === d.id ? "opacity-100" : "opacity-0",
                                      )}
                                    />
                                    <span className="flex-1">{d.name}</span>
                                    {d.governorate && (
                                      <span className="text-xs text-muted-foreground">{d.governorate}</span>
                                    )}
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {selectedDoctor?.doctor_clinics && selectedDoctor.doctor_clinics.length > 0 && (
                  <div>
                    <Label className="mb-1.5 block text-xs font-semibold">العيادة</Label>
                    <Select value={form.clinic_id} onValueChange={(v) => setForm({ ...form, clinic_id: v })}>
                      <SelectTrigger className="h-11 rounded-lg">
                        <SelectValue placeholder="اختر العيادة" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedDoctor.doctor_clinics.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label className="mb-1.5 block text-xs font-semibold">اسم المريض</Label>
                  <Input
                    ref={firstFieldRef}
                    className="h-11 rounded-lg"
                    value={form.patient_name}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setForm({ ...form, patient_name: e.target.value })
                    }
                    placeholder="اكتب اسم المريض"
                    autoComplete="off"
                  />
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <Label className="text-xs font-semibold">تاريخ التسليم</Label>
                    {dueAuto && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary">
                        <Sparkles className="h-3 w-3" /> توقع تلقائي
                      </span>
                    )}
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 w-full justify-between rounded-lg px-3 text-start text-sm font-normal"
                      >
                        <span className={form.due_date ? "" : "text-muted-foreground"}>
                          {formatArabicDate(form.due_date)}
                        </span>
                        <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0" dir="rtl">
                      <DateCalendar
                        mode="single"
                        selected={form.due_date ? new Date(`${form.due_date}T00:00:00`) : undefined}
                        onSelect={(date) => {
                          if (!date) return;
                          setDueAuto(false);
                          setForm({ ...form, due_date: format(date, "yyyy-MM-dd") });
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    تقدير: {baseLeadDays} يوم + حجم العمل (+{extraDays}) ={" "}
                    <span className="font-bold text-foreground">{predictedDays} يوم</span>
                  </p>
                  {!dueAuto && (
                    <button
                      type="button"
                      onClick={() => {
                        setDueAuto(true);
                        setForm((p) => ({ ...p, due_date: predictedDate }));
                      }}
                      className="mt-1 text-[11px] font-medium text-primary hover:underline"
                    >
                      ↺ العودة للتوقع التلقائي
                    </button>
                  )}
                </div>

                <div>
                  <Label className="mb-1.5 block text-xs font-semibold">ملاحظات</Label>
                  <Textarea
                    className="min-h-24 rounded-lg"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={3}
                    placeholder="ملاحظات الطبيب أو تعليمات خاصة..."
                  />
                </div>
              </div>
            </div>

            {/* Summary card */}
            <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-primary/10 p-4 shadow-xs">
              <h3 className="mb-2 text-xs font-bold text-muted-foreground">ملخص</h3>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-2xl font-black text-primary">{validItemsCount}</div>
                  <div className="text-[10px] text-muted-foreground">عناصر</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-primary">{totalUnits}</div>
                  <div className="text-[10px] text-muted-foreground">وحدات</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-primary">{files.length}</div>
                  <div className="text-[10px] text-muted-foreground">ملفات</div>
                </div>
              </div>
            </div>

            {/* Keyboard hints (desktop only) */}
            <div className="hidden rounded-xl border bg-muted/20 p-3 lg:block">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                <Keyboard className="h-3.5 w-3.5" /> اختصارات
              </h3>
              <div className="space-y-1 text-[11px] text-muted-foreground">
                <Shortcut k="Ctrl+S" label="حفظ" />
                <Shortcut k="Ctrl+Enter" label="حفظ + حالة جديدة" />
                {mode === "admin" && <Shortcut k="Ctrl+P" label="حفظ + طباعة" />}
                <Shortcut k="Esc" label="رجوع" />
              </div>
            </div>
          </section>

          {/* RIGHT — Items + Files */}
          <section className="space-y-4 lg:col-span-7">
            {/* Items */}
            <div className="rounded-xl border bg-card p-4 shadow-xs">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                  <Briefcase className="h-4 w-4" /> عناصر العمل
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {items.length}
                  </span>
                </h2>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={noDiagnosis ? "default" : "outline"}
                    onClick={() => setNoDiagnosis((v) => !v)}
                    className="h-8"
                    title="حفظ الحالة بدون تحديد نوع/أسنان — يتم التذكير لاحقًا"
                  >
                    {noDiagnosis ? "✓ بدون تشخيص" : "بدون تشخيص"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setItems((p) => [...p, newItem(loadPrefs())])}
                    className="h-8"
                  >
                    <Plus className="ml-1 h-3.5 w-3.5" /> عنصر
                  </Button>
                </div>
              </div>

              {noDiagnosis && (
                <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  ⚠️ سيتم حفظ الحالة بدون نوع عمل أو أسنان. تذكّر إكمال البيانات لاحقًا من صفحة الحالة.
                </div>
              )}


              <div className="space-y-3">
                {items.map((it, idx) => (
                  <div key={it.id} className="rounded-lg border bg-muted/20 p-3 transition-colors hover:bg-muted/30">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                        عنصر #{idx + 1}
                      </span>
                      {items.length > 1 && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => setItems((p) => p.filter((x) => x.id !== it.id))}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <Label className="mb-1 block text-[11px] font-semibold">
                          نوع العمل <span className="text-destructive">*</span>
                        </Label>
                        <Select value={it.work_type_id} onValueChange={(v) => onWorkTypeChange(it.id, v)}>
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="اختر النوع" />
                          </SelectTrigger>
                          <SelectContent>
                            {workTypes?.map((w) => (
                              <SelectItem key={w.id} value={w.id}>
                                {w.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="mb-1 block text-[11px] font-semibold">اللون (Shade)</Label>
                        <ShadeSelector value={it.shade} onChange={(v) => updateItem(it.id, { shade: v })} />
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="mb-1 block text-[11px] font-semibold">الأسنان</Label>
                        <ToothChart
                          value={it.tooth_numbers}
                          onChange={(v) => {
                            const count = v.split(",").map((s) => s.trim()).filter(Boolean).length;
                            updateItem(it.id, { tooth_numbers: v, units: String(Math.max(count, 1)) });
                          }}
                        />
                      </div>
                      <div>
                        <Label className="mb-1 block text-[11px] font-semibold">الوحدات</Label>
                        <Input
                          type="number"
                          min="1"
                          value={it.units}
                          readOnly
                          className="h-10 bg-muted/50 font-mono text-center font-bold"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Files */}
            <div className="rounded-xl border bg-card p-4 shadow-xs">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                  <Paperclip className="h-4 w-4" /> الملفات
                  {files.length > 0 && (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                      {files.length}
                    </span>
                  )}
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  <input
                    ref={cameraRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    hidden
                    onChange={(e) => {
                      addFiles(e.target.files, "photo");
                      e.target.value = "";
                    }}
                  />
                  <input
                    ref={photoRef}
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(e) => {
                      addFiles(e.target.files, "photo");
                      e.target.value = "";
                    }}
                  />
                  <input
                    ref={scanRef}
                    type="file"
                    accept=".stl,.ply,.obj,.zip,.3mf,.dcm"
                    multiple
                    hidden
                    onChange={(e) => {
                      addFiles(e.target.files, "scan");
                      e.target.value = "";
                    }}
                  />
                  <Button type="button" size="sm" variant="outline" onClick={() => cameraRef.current?.click()} className="h-8">
                    <Camera className="ml-1 h-3.5 w-3.5" /> كاميرا
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => photoRef.current?.click()} className="h-8">
                    <ImageIcon className="ml-1 h-3.5 w-3.5" /> صور
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => scanRef.current?.click()} className="h-8">
                    <FileBox className="ml-1 h-3.5 w-3.5" /> إسكان
                  </Button>
                </div>
              </div>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                className="rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/10 p-3"
              >
                {files.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    <Upload className="mx-auto mb-2 h-6 w-6 opacity-40" />
                    اسحب الملفات هنا أو استخدم الأزرار أعلاه
                  </div>
                ) : (
                  <FileGrid files={files} onRemove={removeFile} />
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Sticky bottom action bar (mobile) */}
      <div className="fixed bottom-0 start-0 end-0 z-30 border-t bg-card/95 p-3 shadow-lg backdrop-blur-md md:hidden">
        <div className="flex gap-2">
          {mode === "admin" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => submit("save_print")}
              disabled={!canSubmit}
              className="flex-1"
            >
              <Printer className="ml-1 h-4 w-4" />
              <span className="text-xs">طباعة</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => submit("save_new")}
            disabled={!canSubmit}
            className="flex-1"
          >
            <Zap className="ml-1 h-4 w-4" />
            <span className="text-xs">+ جديد</span>
          </Button>
          <Button size="sm" onClick={() => submit("save")} disabled={!canSubmit} className="flex-1">
            {submitting ? (
              <Upload className="h-4 w-4 animate-pulse" />
            ) : (
              <>
                <Save className="ml-1 h-4 w-4" />
                <span className="text-xs">حفظ</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Shortcut({ k, label }: { k: string; label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] font-semibold">{k}</kbd>
    </div>
  );
}
