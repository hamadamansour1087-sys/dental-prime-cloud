import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  CategoryAgg,
  CategoryRef,
  DailyTrendRow,
  DeliveredCaseRow,
  DoctorAgg,
  DoctorBalance,
  DoctorRef,
  GovernorateAgg,
  PaymentRow,
  ReceivedCaseRow,
  ReportsFilters,
  WorkTypeAgg,
  WorkTypeRef,
} from "./types";

export function useReportsData(labId: string | null | undefined, f: ReportsFilters) {
  const { range, doctorFilter, workTypeFilter, categoryFilter, governorateFilter } = f;

  const { data: doctors = [] } = useQuery({
    queryKey: ["rep-doctors", labId],
    enabled: !!labId,
    queryFn: async (): Promise<DoctorRef[]> => {
      const { data } = await supabase.from("doctors").select("id,name,governorate").eq("lab_id", labId!).order("name");
      return (data ?? []) as DoctorRef[];
    },
  });

  const { data: workTypes = [] } = useQuery({
    queryKey: ["rep-worktypes", labId],
    enabled: !!labId,
    queryFn: async (): Promise<WorkTypeRef[]> => {
      const { data } = await supabase.from("work_types").select("id,name,category_id").eq("lab_id", labId!).order("name");
      return (data ?? []) as WorkTypeRef[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["rep-cats", labId],
    enabled: !!labId,
    queryFn: async (): Promise<CategoryRef[]> => {
      const { data } = await supabase.from("work_type_categories").select("id,name,color").eq("lab_id", labId!).order("order_index");
      return (data ?? []) as CategoryRef[];
    },
  });

  const { data: deliveredCases = [], isLoading: loadingDelivered, refetch: refetchDelivered } = useQuery({
    queryKey: ["rep-delivered", labId, range, doctorFilter, workTypeFilter, categoryFilter, governorateFilter],
    enabled: !!labId,
    queryFn: async (): Promise<DeliveredCaseRow[]> => {
      let q = supabase
        .from("cases")
        .select("id,case_number,date_delivered,date_received,price,units,doctor_id,work_type_id,status")
        .eq("lab_id", labId!)
        .eq("status", "delivered")
        .gte("date_delivered", `${range.from}T00:00:00`)
        .lte("date_delivered", `${range.to}T23:59:59`)
        .limit(5000);
      if (doctorFilter !== "all") q = q.eq("doctor_id", doctorFilter);
      if (workTypeFilter !== "all") q = q.eq("work_type_id", workTypeFilter);
      const { data, error } = await q;
      if (error) throw error;
      let rows = (data ?? []) as DeliveredCaseRow[];
      if (categoryFilter !== "all") {
        const wtIds = new Set(workTypes.filter((w) => w.category_id === categoryFilter).map((w) => w.id));
        rows = rows.filter((r) => r.work_type_id && wtIds.has(r.work_type_id));
      }
      if (governorateFilter !== "all") {
        const docIds = new Set(doctors.filter((d) => d.governorate === governorateFilter).map((d) => d.id));
        rows = rows.filter((r) => r.doctor_id && docIds.has(r.doctor_id));
      }
      return rows;
    },
  });

  const { data: receivedCases = [] } = useQuery({
    queryKey: ["rep-received", labId, range, doctorFilter, workTypeFilter, categoryFilter, governorateFilter],
    enabled: !!labId,
    queryFn: async (): Promise<ReceivedCaseRow[]> => {
      let q = supabase
        .from("cases")
        .select("id,date_received,doctor_id,work_type_id,units,status")
        .eq("lab_id", labId!)
        .gte("date_received", range.from)
        .lte("date_received", range.to)
        .limit(5000);
      if (doctorFilter !== "all") q = q.eq("doctor_id", doctorFilter);
      if (workTypeFilter !== "all") q = q.eq("work_type_id", workTypeFilter);
      const { data } = await q;
      let rows = (data ?? []) as ReceivedCaseRow[];
      if (categoryFilter !== "all") {
        const wtIds = new Set(workTypes.filter((w) => w.category_id === categoryFilter).map((w) => w.id));
        rows = rows.filter((r) => r.work_type_id && wtIds.has(r.work_type_id));
      }
      if (governorateFilter !== "all") {
        const docIds = new Set(doctors.filter((d) => d.governorate === governorateFilter).map((d) => d.id));
        rows = rows.filter((r) => r.doctor_id && docIds.has(r.doctor_id));
      }
      return rows;
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["rep-payments", labId, range, doctorFilter],
    enabled: !!labId,
    queryFn: async (): Promise<PaymentRow[]> => {
      let q = supabase
        .from("payments")
        .select("id,doctor_id,amount,payment_date,method")
        .eq("lab_id", labId!)
        .gte("payment_date", range.from)
        .lte("payment_date", range.to)
        .limit(5000);
      if (doctorFilter !== "all") q = q.eq("doctor_id", doctorFilter);
      const { data } = await q;
      return (data ?? []) as PaymentRow[];
    },
  });

  const { data: allDoctorsBalance = [] } = useQuery({
    queryKey: ["rep-balances", labId, doctorFilter, governorateFilter, doctors.length],
    enabled: !!labId && doctors.length > 0,
    queryFn: async (): Promise<DoctorBalance[]> => {
      const [allDelivered, allPayments] = await Promise.all([
        supabase.from("cases").select("doctor_id,price").eq("lab_id", labId!).eq("status", "delivered").limit(50000),
        supabase.from("payments").select("doctor_id,amount").eq("lab_id", labId!).limit(50000),
      ]);
      const billedMap = new Map<string, number>();
      ((allDelivered.data ?? []) as Array<{ doctor_id: string | null; price: number | null }>).forEach((c) => {
        if (!c.doctor_id) return;
        billedMap.set(c.doctor_id, (billedMap.get(c.doctor_id) ?? 0) + (Number(c.price) || 0));
      });
      const paidMap = new Map<string, number>();
      ((allPayments.data ?? []) as Array<{ doctor_id: string; amount: number }>).forEach((p) => {
        paidMap.set(p.doctor_id, (paidMap.get(p.doctor_id) ?? 0) + (Number(p.amount) || 0));
      });
      let docs = doctors;
      if (doctorFilter !== "all") docs = docs.filter((d) => d.id === doctorFilter);
      if (governorateFilter !== "all") docs = docs.filter((d) => d.governorate === governorateFilter);
      return docs.map((d) => {
        const billed = billedMap.get(d.id) ?? 0;
        const paid = paidMap.get(d.id) ?? 0;
        return { ...d, billed, paid, balance: billed - paid };
      });
    },
  });

  const wtMap = useMemo(() => new Map(workTypes.map((w) => [w.id, w])), [workTypes]);
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const docMap = useMemo(() => new Map(doctors.map((d) => [d.id, d])), [doctors]);

  const productionByWorkType = useMemo<WorkTypeAgg[]>(() => {
    const map = new Map<string, WorkTypeAgg>();
    deliveredCases.forEach((c) => {
      const wt = c.work_type_id ? wtMap.get(c.work_type_id) : null;
      const name = wt?.name ?? "غير محدد";
      const cur = map.get(name) ?? { name, count: 0, units: 0, revenue: 0 };
      cur.count += 1;
      cur.units += Number(c.units) || 0;
      cur.revenue += Number(c.price) || 0;
      map.set(name, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [deliveredCases, wtMap]);

  const productionByCategory = useMemo<CategoryAgg[]>(() => {
    const map = new Map<string, CategoryAgg>();
    deliveredCases.forEach((c) => {
      const wt = c.work_type_id ? wtMap.get(c.work_type_id) : null;
      const cat = wt?.category_id ? catMap.get(wt.category_id) : null;
      const name = cat?.name ?? "بدون فئة";
      const color = cat?.color ?? "#6B7280";
      const cur = map.get(name) ?? { name, count: 0, units: 0, revenue: 0, color };
      cur.count += 1;
      cur.units += Number(c.units) || 0;
      cur.revenue += Number(c.price) || 0;
      map.set(name, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [deliveredCases, wtMap, catMap]);

  const productionByDoctor = useMemo<DoctorAgg[]>(() => {
    const map = new Map<string, DoctorAgg>();
    deliveredCases.forEach((c) => {
      if (!c.doctor_id) return;
      const d = docMap.get(c.doctor_id);
      const name = d?.name ?? "غير محدد";
      const cur = map.get(c.doctor_id) ?? { name, count: 0, units: 0, revenue: 0, paid: 0 };
      cur.count += 1;
      cur.units += Number(c.units) || 0;
      cur.revenue += Number(c.price) || 0;
      map.set(c.doctor_id, cur);
    });
    payments.forEach((p) => {
      const cur = map.get(p.doctor_id);
      if (cur) cur.paid += Number(p.amount) || 0;
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [deliveredCases, payments, docMap]);

  const productionByGovernorate = useMemo<GovernorateAgg[]>(() => {
    const map = new Map<string, { name: string; count: number; units: number; revenue: number; doctors: Set<string> }>();
    deliveredCases.forEach((c) => {
      if (!c.doctor_id) return;
      const d = docMap.get(c.doctor_id);
      const name = d?.governorate ?? "غير محدد";
      const cur = map.get(name) ?? { name, count: 0, units: 0, revenue: 0, doctors: new Set<string>() };
      cur.count += 1;
      cur.units += Number(c.units) || 0;
      cur.revenue += Number(c.price) || 0;
      cur.doctors.add(c.doctor_id);
      map.set(name, cur);
    });
    return Array.from(map.values())
      .map((g) => ({ name: g.name, count: g.count, units: g.units, revenue: g.revenue, doctors: g.doctors.size }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [deliveredCases, docMap]);

  const dailyTrend = useMemo<DailyTrendRow[]>(() => {
    const map = new Map<string, DailyTrendRow>();
    deliveredCases.forEach((c) => {
      if (!c.date_delivered) return;
      const day = c.date_delivered.slice(0, 10);
      const cur = map.get(day) ?? { date: day, revenue: 0, cases: 0, payments: 0 };
      cur.revenue += Number(c.price) || 0;
      cur.cases += 1;
      map.set(day, cur);
    });
    payments.forEach((p) => {
      const day = p.payment_date;
      const cur = map.get(day) ?? { date: day, revenue: 0, cases: 0, payments: 0 };
      cur.payments += Number(p.amount) || 0;
      map.set(day, cur);
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [deliveredCases, payments]);

  // Remake / repair cases in the period (received in range)
  const { data: remakeRepairCases = [] } = useQuery({
    queryKey: ["rep-remakes", labId, range, doctorFilter],
    enabled: !!labId,
    queryFn: async () => {
      let q = supabase
        .from("cases")
        .select("id,case_number,case_type,date_received,date_delivered,units,price,doctor_id,work_type_id,status,parent_case_id,notes")
        .eq("lab_id", labId!)
        .in("case_type", ["remake", "repair"])
        .gte("date_received", range.from)
        .lte("date_received", range.to)
        .limit(5000);
      if (doctorFilter !== "all") q = q.eq("doctor_id", doctorFilter);
      const { data } = await q;
      return (data ?? []) as Array<{
        id: string; case_number: string; case_type: string; date_received: string | null;
        date_delivered: string | null; units: number | null; price: number | null;
        doctor_id: string | null; work_type_id: string | null; status: string | null;
        parent_case_id: string | null; notes: string | null;
      }>;
    },
  });

  // Technician production: cases that passed through "ready" stage in the period
  const { data: technicianProduction = [] } = useQuery({
    queryKey: ["rep-tech-prod", labId, range],
    enabled: !!labId,
    queryFn: async () => {
      const { data: history } = await supabase
        .from("case_stage_history")
        .select("technician_id, case_id, entered_at, workflow_stages(code)")
        .eq("lab_id", labId!)
        .not("technician_id", "is", null)
        .gte("entered_at", range.from)
        .lte("entered_at", range.to + "T23:59:59")
        .limit(10000);
      const filtered = ((history ?? []) as Array<{
        technician_id: string; case_id: string;
        workflow_stages: { code: string } | null;
      }>).filter((h) => h.workflow_stages?.code === "ready");
      const caseIds = Array.from(new Set(filtered.map((h) => h.case_id)));
      const unitsByCase = new Map<string, number>();
      if (caseIds.length) {
        const { data: cs } = await supabase.from("cases").select("id,units").in("id", caseIds);
        (cs ?? []).forEach((c: { id: string; units: number | null }) => unitsByCase.set(c.id, c.units ?? 0));
      }
      // Find which of those cases later spawned a remake/repair (quality metric)
      let remakeParentIds = new Set<string>();
      if (caseIds.length) {
        const { data: kids } = await supabase
          .from("cases")
          .select("parent_case_id")
          .eq("lab_id", labId!)
          .in("case_type", ["remake", "repair"])
          .in("parent_case_id", caseIds);
        (kids ?? []).forEach((k: { parent_case_id: string | null }) => {
          if (k.parent_case_id) remakeParentIds.add(k.parent_case_id);
        });
      }
      const { data: techs } = await supabase.from("technicians").select("id,name").eq("lab_id", labId!);
      const techMap = new Map<string, string>();
      ((techs ?? []) as Array<{ id: string; name: string }>).forEach((t) => techMap.set(t.id, t.name));

      const agg = new Map<string, { id: string; name: string; cases: number; units: number; remakes: number; caseIds: Set<string> }>();
      filtered.forEach((h) => {
        const cur = agg.get(h.technician_id) ?? {
          id: h.technician_id, name: techMap.get(h.technician_id) ?? "—",
          cases: 0, units: 0, remakes: 0, caseIds: new Set<string>(),
        };
        if (!cur.caseIds.has(h.case_id)) {
          cur.caseIds.add(h.case_id);
          cur.cases += 1;
          cur.units += unitsByCase.get(h.case_id) ?? 0;
          if (remakeParentIds.has(h.case_id)) cur.remakes += 1;
        }
        agg.set(h.technician_id, cur);
      });
      return Array.from(agg.values())
        .map((v) => ({ id: v.id, name: v.name, cases: v.cases, units: v.units, remakes: v.remakes,
          quality: v.cases > 0 ? Math.round(((v.cases - v.remakes) / v.cases) * 100) : 100 }))
        .sort((a, b) => b.units - a.units);
    },
  });

  const totalRevenue = deliveredCases.reduce((s, c) => s + (Number(c.price) || 0), 0);
  const totalCollected = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const totalDelivered = deliveredCases.length;
  const totalReceived = receivedCases.length;
  const totalReceivables = allDoctorsBalance.reduce((s, d) => s + (d.balance > 0 ? d.balance : 0), 0);

  return {
    doctors,
    workTypes,
    categories,
    deliveredCases,
    receivedCases,
    payments,
    allDoctorsBalance,
    docMap,
    productionByWorkType,
    productionByCategory,
    productionByDoctor,
    productionByGovernorate,
    dailyTrend,
    totalRevenue,
    totalCollected,
    totalDelivered,
    totalReceived,
    totalReceivables,
    loadingDelivered,
    refetchDelivered,
  };
}

export type ReportsData = ReturnType<typeof useReportsData>;
