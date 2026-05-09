import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format, addDays } from "date-fns";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  type CaseEntryItem,
  type CaseEntryMode,
  type DoctorOption,
  type PendingFileMeta,
  type SubmitMode,
  type WorkTypeOption,
  SCAN_EXT,
} from "./types";
import {
  loadPrefs,
  makeDraftKey,
  newItem,
  printThermalSlip,
  savePrefs,
} from "./utils";

export interface UseCaseEntryFormOptions {
  mode: CaseEntryMode;
  labId: string;
  fixedDoctorId?: string;
  editCaseId?: string;
  onSaved?: (caseId: string, caseNumber: string) => void;
  onCancel?: () => void;
}

export function useCaseEntryForm(opts: UseCaseEntryFormOptions) {
  const { mode, labId, fixedDoctorId, editCaseId, onSaved, onCancel } = opts;
  const navigate = useNavigate();
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
  const [, setDraftRestored] = useState(false);
  const [labName, setLabName] = useState<string | undefined>();
  const [doctorPickerOpen, setDoctorPickerOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [scanPreviewId, setScanPreviewId] = useState<string | null>(null);

  const fileBlobsRef = useRef<Map<string, File>>(new Map());
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
        .select("id, name, category_id")
        .eq("is_active", true)
        .order("name")).data ?? []) as (WorkTypeOption & { category_id: string | null })[],
  });

  const { data: workCategories } = useQuery({
    queryKey: ["work-categories-entry", labId],
    enabled: !!labId,
    queryFn: async () =>
      ((await supabase
        .from("work_type_categories")
        .select("id, avg_delivery_days")).data ?? []) as { id: string; avg_delivery_days: number | null }[],
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

  // ---------- load existing case for editing ----------
  const isEdit = !!editCaseId;
  const [editLoaded, setEditLoaded] = useState(false);
  const [existingAttachments, setExistingAttachments] = useState<PendingFileMeta[]>([]);
  const { data: editCase } = useQuery({
    queryKey: ["edit-case", editCaseId],
    enabled: isEdit,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("*, patients(id, name)")
        .eq("id", editCaseId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: editItems } = useQuery({
    queryKey: ["edit-case-items", editCaseId],
    enabled: isEdit,
    queryFn: async () => {
      const { data } = await supabase
        .from("case_items")
        .select("*")
        .eq("case_id", editCaseId!)
        .order("position");
      return data ?? [];
    },
  });

  const { data: editAttachments } = useQuery({
    queryKey: ["edit-case-attachments", editCaseId],
    enabled: isEdit,
    queryFn: async () => {
      const { data } = await supabase
        .from("case_attachments")
        .select("*")
        .eq("case_id", editCaseId!)
        .order("created_at");
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!isEdit || editLoaded || !editCase) return;

    let patientName = (editCase as any).patients?.name ?? "";
    let cleanNotes = editCase.notes ?? "";
    if (!patientName && cleanNotes) {
      const match = cleanNotes.match(/(?:^|\n)المريض:\s*(.+?)(?:\n|$)/);
      if (match) {
        patientName = match[1].trim();
        cleanNotes = cleanNotes.replace(/(?:^|\n)المريض:\s*.+?(?:\n|$)/, "\n").trim();
      }
    }

    setForm({
      doctor_id: editCase.doctor_id ?? fixedDoctorId ?? "",
      clinic_id: "",
      patient_name: patientName,
      due_date: editCase.due_date ?? "",
      notes: cleanNotes,
    });
    if (editItems?.length) {
      setItems(
        editItems.map((it: any) => ({
          id: it.id,
          work_type_id: it.work_type_id ?? "",
          tooth_numbers: it.tooth_numbers ?? "",
          shade: it.shade ?? "",
          units: String(it.units ?? 1),
          unit_price: it.unit_price != null ? String(it.unit_price) : "",
        }))
      );
    }

    if (editAttachments?.length) {
      const mapped: PendingFileMeta[] = editAttachments.map((a: any) => ({
        id: `existing-${a.id}`,
        name: a.file_name,
        size: a.file_size ?? 0,
        type: a.mime_type ?? "",
        kind: a.kind === "photo" ? ("photo" as const) : ("scan" as const),
        previewUrl: undefined,
        _storagePath: a.storage_path,
        _attachmentId: a.id,
      }));
      setExistingAttachments(mapped);

      (async () => {
        const withUrls = await Promise.all(
          editAttachments.map(async (a: any) => {
            if (a.kind !== "photo") return null;
            for (const bucket of ["case-attachments", "case-media"]) {
              const { data: signed } = await supabase.storage
                .from(bucket)
                .createSignedUrl(a.storage_path, 60 * 60);
              if (signed?.signedUrl) return { id: `existing-${a.id}`, url: signed.signedUrl };
            }
            return null;
          }),
        );
        setExistingAttachments((prev) =>
          prev.map((f) => {
            const match = withUrls.find((u) => u?.id === f.id);
            return match ? { ...f, previewUrl: match.url } : f;
          }),
        );
      })();
    }

    setDueAuto(false);
    setEditLoaded(true);
  }, [isEdit, editLoaded, editCase, editItems, editAttachments, fixedDoctorId]);

  useEffect(() => {
    if (!labId) return;
    supabase.from("labs").select("name").eq("id", labId).maybeSingle().then(({ data }) => {
      if (data?.name) setLabName(data.name);
    });
  }, [labId]);

  // ---------- draft auto-save (DISABLED by user request) ----------
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isEdit) return;
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
  }, [DRAFT_KEY, isEdit]);

  // ---------- predicted due date ----------
  const stagesLeadDays = (stages ?? []).reduce(
    (s: number, st: { estimated_days: number | null }) => s + (Number(st.estimated_days) || 0),
    0,
  );
  const catMap = new Map((workCategories ?? []).map((c) => [c.id, Number(c.avg_delivery_days) || 0]));
  const wtCatMap = new Map((workTypes ?? []).map((w: any) => [w.id, w.category_id as string | null]));
  const selectedCategoryDays = items
    .map((it) => (it.work_type_id ? catMap.get(wtCatMap.get(it.work_type_id) ?? "") ?? 0 : 0))
    .filter((d) => d > 0);
  const categoryLeadDays = selectedCategoryDays.length ? Math.max(...selectedCategoryDays) : 0;
  const baseLeadDays = Math.max(stagesLeadDays, categoryLeadDays) || 5;
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

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, newItem(loadPrefs())]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
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

  const removeExistingAttachment = useCallback((id: string) => {
    setExistingAttachments((prev) => prev.filter((f) => f.id !== id));
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
      window.setTimeout(() => {
        if (mode === "admin" && !preserveDoctor && !fixedDoctorId) {
          setDoctorPickerOpen(true);
        } else {
          firstFieldRef.current?.focus();
        }
      }, 50);
    },
    [files, form.doctor_id, form.clinic_id, fixedDoctorId, DRAFT_KEY, mode],
  );

  // ---------- submit ----------
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

      let caseId: string;
      let caseNumber: string;

      if (isEdit && editCaseId) {
        const updatePayload = {
          doctor_id: form.doctor_id,
          patient_id: patientId ?? (editCase as any)?.patient_id ?? null,
          work_type_id: first?.work_type_id || null,
          shade: allShades || null,
          tooth_numbers: allTeeth || null,
          units: totalUnits || 1,
          price: totalPrice || null,
          due_date: form.due_date || null,
          notes: finalNotes,
        } as const;
        const { error } = await supabase.from("cases").update(updatePayload).eq("id", editCaseId);
        if (error) throw error;

        caseId = editCaseId;
        caseNumber = (editCase as any)?.case_number ?? "";

        await supabase.from("case_items").delete().eq("case_id", editCaseId);
        const itemRows = validItems.map((it, idx) => {
          const u = parseInt(it.units) || 1;
          const p = it.unit_price ? parseFloat(it.unit_price) : null;
          return {
            lab_id: labId,
            case_id: editCaseId,
            work_type_id: it.work_type_id,
            tooth_numbers: it.tooth_numbers || null,
            shade: it.shade || null,
            units: u,
            unit_price: p,
            total_price: p != null ? p * u : null,
            position: idx,
          };
        });
        if (itemRows.length) {
          const { error: itemsErr } = await supabase.from("case_items").insert(itemRows);
          if (itemsErr) throw itemsErr;
        }

        if (editAttachments?.length) {
          const keptIds = new Set(existingAttachments.map((f) => f.id.replace("existing-", "")));
          const toDelete = editAttachments.filter((a: any) => !keptIds.has(a.id));
          for (const att of toDelete) {
            await supabase.from("case_attachments").delete().eq("id", (att as any).id);
          }
        }
      } else {
        const { data: caseNum } = isPortal
          ? { data: `PND-${Date.now()}` }
          : await supabase.rpc("generate_case_number", { _lab_id: labId });

        const { data: wf } = isPortal
          ? { data: null }
          : await supabase.from("workflows").select("id").eq("is_default", true).maybeSingle();

        const startStage = isPortal
          ? null
          : ((stages ?? []).find((s: { order_index: number }) => s.order_index === 1) as { id: string } | undefined);

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

        caseId = created.id;
        caseNumber = created.case_number;

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
      }

      // Upload new attachments
      const attachmentFiles = files
        .map((f) => ({ ...f, blob: fileBlobsRef.current.get(f.id) }))
        .filter((f): f is PendingFileMeta & { blob: File } => !!f.blob);

      const uploadAttachments = async () => {
        if (!attachmentFiles.length) return;
        const toastId = toast.loading(`تم حفظ الحالة، جاري رفع ${attachmentFiles.length} ملف في الخلفية...`);
        const scanFiles = attachmentFiles.filter((f) => f.kind === "scan");
        const otherFiles = attachmentFiles.filter((f) => f.kind !== "scan");
        let uploadFailures = 0;
        const uploadOne = async (pf: PendingFileMeta & { blob: File }) => {
          const safeName = pf.name.replace(/[^\\w.\\-]+/g, "_");
          const bucket = isPortal ? "case-attachments" : "case-media";
          const path = isPortal
            ? `${labId}/${caseId}/${Date.now()}_${safeName}`
            : `${labId}/${caseId}/${pf.kind}/${Date.now()}_${safeName}`;
          const { error: upErr } = await supabase.storage.from(bucket).upload(path, pf.blob, {
            contentType: pf.type || undefined,
            upsert: false,
          });
          if (upErr) {
            uploadFailures += 1;
            toast.error(`فشل رفع ${pf.name}: ${upErr.message}`);
            return;
          }
          const { error: attErr } = await supabase.from("case_attachments").insert({
            lab_id: labId,
            case_id: caseId,
            storage_path: path,
            file_name: pf.name,
            file_size: pf.size,
            mime_type: pf.type || null,
            kind: pf.kind,
          });
          if (attErr) {
            uploadFailures += 1;
            toast.error(`تم رفع ${pf.name} لكن تعذر ربطه بالحالة`);
          }
        };
        const SCAN_CONCURRENCY = 2;
        for (let i = 0; i < scanFiles.length; i += SCAN_CONCURRENCY) {
          await Promise.all(scanFiles.slice(i, i + SCAN_CONCURRENCY).map(uploadOne));
        }
        const OTHER_CONCURRENCY = 3;
        for (let i = 0; i < otherFiles.length; i += OTHER_CONCURRENCY) {
          await Promise.all(otherFiles.slice(i, i + OTHER_CONCURRENCY).map(uploadOne));
        }
        if (uploadFailures > 0) {
          toast.warning("تم حفظ الحالة، لكن بعض الملفات لم ترفع بسبب الاتصال. أعد رفعها من صفحة الحالة.", { duration: 8000 });
          toast.dismiss(toastId);
        } else {
          toast.success("اكتمل رفع ملفات الحالة", { id: toastId });
        }
      };
      void uploadAttachments();

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

      const successMsg = isEdit
        ? `تم تعديل الحالة رقم ${caseNumber}`
        : isPortal
          ? "تم رفع الحالة بنجاح، بانتظار موافقة المعمل"
          : `تم تسجيل الحالة رقم ${caseNumber}`;

      if (submitMode === "save_print") {
        const doctorName = doctors?.find((d) => d.id === form.doctor_id)?.name ?? "";
        const workTypeNames = validItems
          .map((it) => workTypes?.find((w) => w.id === it.work_type_id)?.name ?? "")
          .filter(Boolean)
          .join(" + ");
        printThermalSlip({
          caseNumber,
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

      if (submitMode === "save_new" && !isEdit) {
        resetForm(true);
      } else {
        if (onSaved) onSaved(caseId, caseNumber);
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

  // Keep submit reference fresh for keyboard shortcut effect
  const submitRef = useRef(submit);
  submitRef.current = submit;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement && e.key !== "s" && !(e.ctrlKey || e.metaKey)) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === "s") {
        e.preventDefault();
        submitRef.current("save");
      } else if (ctrl && e.key === "Enter") {
        e.preventDefault();
        submitRef.current("save_new");
      } else if (ctrl && e.key === "p") {
        e.preventDefault();
        submitRef.current("save_print");
      } else if (e.key === "Escape" && !submitting) {
        if (onCancel) onCancel();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [submitting, onCancel]);

  // Auto-focus on mount
  useEffect(() => {
    if (mode === "admin" && !fixedDoctorId && !form.doctor_id) {
      window.setTimeout(() => setDoctorPickerOpen(true), 150);
    } else {
      window.setTimeout(() => firstFieldRef.current?.focus(), 100);
    }
    // mount-only intentionally
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return {
    // mode
    mode,
    isEdit,
    fixedDoctorId,
    onCancel,
    // refs
    firstFieldRef,
    fileBlobsRef,
    // form state
    form,
    setForm,
    items,
    addItem,
    removeItem,
    updateItem,
    onWorkTypeChange,
    files,
    addFiles,
    removeFile,
    existingAttachments,
    removeExistingAttachment,
    onDrop,
    dueAuto,
    setDueAuto,
    noDiagnosis,
    setNoDiagnosis,
    submitting,
    labName,
    nextCaseNumber,
    // queries
    doctors,
    workTypes,
    // dialogs
    doctorPickerOpen,
    setDoctorPickerOpen,
    cameraOpen,
    setCameraOpen,
    scanPreviewId,
    setScanPreviewId,
    // derived
    selectedDoctor,
    grandTotal,
    totalUnits,
    validItemsCount,
    canSubmit,
    baseLeadDays,
    extraDays,
    predictedDays,
    predictedDate,
    // actions
    submit,
  };
}

export type CaseEntryFormApi = ReturnType<typeof useCaseEntryForm>;
