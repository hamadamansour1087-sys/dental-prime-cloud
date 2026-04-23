import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/portal/statement")({
  component: PortalStatement,
});

function PortalStatement() {
  const { user } = useAuth();

  const { data: doctor } = useQuery({
    queryKey: ["statement-doctor", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("doctors")
        .select("id, opening_balance")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: cases } = useQuery({
    queryKey: ["statement-cases", doctor?.id],
    enabled: !!doctor,
    queryFn: async () =>
      (
        await supabase
          .from("cases")
          .select("id, case_number, date_received, price, status")
          .neq("status", "pending_approval")
          .neq("status", "cancelled")
          .order("date_received", { ascending: true })
      ).data ?? [],
  });

  const { data: payments } = useQuery({
    queryKey: ["statement-payments", doctor?.id],
    enabled: !!doctor,
    queryFn: async () =>
      (await supabase.from("payments").select("id, payment_date, amount, method, reference").order("payment_date")).data ?? [],
  });

  type Row = { date: string; desc: string; debit: number; credit: number };
  const rows: Row[] = [];
  if (doctor?.opening_balance) {
    rows.push({ date: "—", desc: "رصيد افتتاحي", debit: Number(doctor.opening_balance), credit: 0 });
  }
  (cases ?? []).forEach((c: any) =>
    rows.push({ date: c.date_received, desc: `حالة ${c.case_number}`, debit: Number(c.price ?? 0), credit: 0 })
  );
  (payments ?? []).forEach((p: any) =>
    rows.push({
      date: p.payment_date,
      desc: `دفعة${p.method ? ` (${p.method})` : ""}${p.reference ? ` — ${p.reference}` : ""}`,
      debit: 0,
      credit: Number(p.amount),
    })
  );
  rows.sort((a, b) => (a.date < b.date ? -1 : 1));

  let balance = 0;
  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">كشف الحساب</h1>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">إجمالي المستحق</p>
            <p className="mt-1 text-lg font-bold">{totalDebit.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">إجمالي المدفوع</p>
            <p className="mt-1 text-lg font-bold text-green-600">{totalCredit.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">الرصيد المتبقي</p>
            <p
              className={`mt-1 text-lg font-bold ${
                totalDebit - totalCredit > 0 ? "text-destructive" : "text-green-600"
              }`}
            >
              {(totalDebit - totalCredit).toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">الحركات</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-right">
                  <th className="p-2">التاريخ</th>
                  <th className="p-2">البيان</th>
                  <th className="p-2">مدين</th>
                  <th className="p-2">دائن</th>
                  <th className="p-2">الرصيد</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  balance += r.debit - r.credit;
                  return (
                    <tr key={i} className="border-t">
                      <td className="p-2 whitespace-nowrap">{r.date}</td>
                      <td className="p-2">{r.desc}</td>
                      <td className="p-2 font-mono">{r.debit ? r.debit.toFixed(2) : "—"}</td>
                      <td className="p-2 font-mono text-green-600">{r.credit ? r.credit.toFixed(2) : "—"}</td>
                      <td className="p-2 font-mono font-semibold">{balance.toFixed(2)}</td>
                    </tr>
                  );
                })}
                {!rows.length && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">
                      لا توجد حركات بعد
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
