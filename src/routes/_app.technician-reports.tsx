import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy } from "lucide-react";
import { DatePickerInput } from "@/components/ui/date-picker-input";

export const Route = createFileRoute("/_app/technician-reports")({
  component: TechnicianReportsPage,
});

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function endOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
}

function TechnicianReportsPage() {
  const { labId } = useAuth();
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(endOfMonth());

  const { data: rows } = useQuery({
    queryKey: ["technician-production", labId, from, to],
    enabled: !!labId,
    queryFn: async () => {
      // History entries marking technician work for the "ready" stage (delivery handoff)
      const { data: history } = await supabase
        .from("case_stage_history")
        .select("technician_id, case_id, entered_at, workflow_stages(code, name)")
        .not("technician_id", "is", null)
        .gte("entered_at", from)
        .lte("entered_at", to + "T23:59:59");

      const filtered = (history ?? []).filter((h: any) => h.workflow_stages?.code === "ready");

      // Pull units for involved cases
      const caseIds = Array.from(new Set(filtered.map((h: any) => h.case_id)));
      let unitsByCase = new Map<string, number>();
      if (caseIds.length) {
        const { data: cases } = await supabase.from("cases").select("id, units").in("id", caseIds);
        cases?.forEach((c: any) => unitsByCase.set(c.id, c.units ?? 0));
      }

      const { data: techs } = await supabase.from("technicians").select("id, name");
      const techMap = new Map<string, string>();
      (techs ?? []).forEach((t: any) => techMap.set(t.id, t.name));

      const agg = new Map<string, { name: string; cases: number; units: number }>();
      filtered.forEach((h: any) => {
        const tid = h.technician_id as string;
        const name = techMap.get(tid) ?? "—";
        const u = unitsByCase.get(h.case_id) ?? 0;
        const cur = agg.get(tid) ?? { name, cases: 0, units: 0 };
        cur.cases += 1;
        cur.units += u;
        agg.set(tid, cur);
      });

      return Array.from(agg.entries())
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.units - a.units);
    },
  });

  const totals = useMemo(
    () => ({
      cases: rows?.reduce((s, r) => s + r.cases, 0) ?? 0,
      units: rows?.reduce((s, r) => s + r.units, 0) ?? 0,
    }),
    [rows]
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">تقرير إنتاج الفنيين</h1>
        <p className="text-sm text-muted-foreground">عدد الحالات والوحدات المنجزة لكل فني (وفق مرحلة "جاهز للتسليم")</p>
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          <div>
            <Label className="text-xs">من تاريخ</Label>
            <DatePickerInput value={from} onChange={setFrom} placeholder="من تاريخ" className="w-full" />
          </div>
          <div>
            <Label className="text-xs">إلى تاريخ</Label>
            <DatePickerInput value={to} onChange={setTo} placeholder="إلى تاريخ" className="w-full" />
          </div>
          <div className="rounded-md border bg-muted/30 p-2">
            <p className="text-xs text-muted-foreground">إجمالي الحالات</p>
            <p className="text-xl font-bold">{totals.cases}</p>
          </div>
          <div className="rounded-md border bg-primary/5 p-2">
            <p className="text-xs text-muted-foreground">إجمالي الوحدات</p>
            <p className="text-xl font-bold text-primary">{totals.units}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Trophy className="h-4 w-4" /> الترتيب</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {!rows?.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">لا توجد بيانات إنتاج في هذه الفترة</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>الفني</TableHead>
                  <TableHead className="text-center">الحالات</TableHead>
                  <TableHead className="text-center">الوحدات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-center font-mono">{r.cases}</TableCell>
                    <TableCell className="text-center font-mono font-bold text-primary">{r.units}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
