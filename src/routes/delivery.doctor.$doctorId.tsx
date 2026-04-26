import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Wallet, Plus, ArrowRight, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/delivery/doctor/$doctorId")({
  component: AgentDoctorDetail,
});

function AgentDoctorDetail() {
  const { doctorId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("statement");
  const [collectOpen, setCollectOpen] = useState(false);

  const { data: doctor } = useQuery({
    queryKey: ["doctor-detail", doctorId],
    queryFn: async () => {
      const { data } = await supabase.from("doctors")
        .select("id, name, phone, governorate, opening_balance, clinic_name").eq("id", doctorId).maybeSingle();
      return data;
    },
  });

  const { data: ledger } = useQuery({
    queryKey: ["doctor-ledger-agent", doctorId],
    queryFn: async () => {
      const [casesRes, paymentsRes] = await Promise.all([
        supabase.from("cases").select("id, case_number, date_received, price, status").eq("doctor_id", doctorId).order("date_received", { ascending: false }).limit(30),
        supabase.from("payments").select("id, payment_date, amount, method").eq("doctor_id", doctorId).order("payment_date", { ascending: false }).limit(30),
      ]);
      const cases = casesRes.data ?? [];
      const payments = paymentsRes.data ?? [];
      const charges = cases.filter((c) => c.status !== "cancelled").reduce((s, c) => s + Number(c.price ?? 0), 0);
      const paid = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
      return { cases, payments, charges, paid };
    },
  });

  const opening = Number(doctor?.opening_balance ?? 0);
  const balance = opening + (ledger?.charges ?? 0) - (ledger?.paid ?? 0);

  return (
    <div className="space-y-3" dir="rtl">
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/delivery/doctors" })}>
        <ChevronRight className="h-4 w-4" /> رجوع
      </Button>

      {doctor && (
        <Card className="p-4">
          <p className="text-lg font-bold">{doctor.name}</p>
          {doctor.clinic_name && <p className="text-xs text-muted-foreground">{doctor.clinic_name}</p>}
          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded bg-muted p-2">
              <p className="text-xs text-muted-foreground">الرصيد المستحق</p>
              <p className={`text-xl font-bold ${balance > 0 ? "text-destructive" : "text-primary"}`}>
                {balance.toFixed(2)}
              </p>
            </div>
            <div className="rounded bg-muted p-2">
              <p className="text-xs text-muted-foreground">المدفوع</p>
              <p className="text-xl font-bold text-primary">{(ledger?.paid ?? 0).toFixed(2)}</p>
            </div>
          </div>
          <Button className="w-full mt-3" onClick={() => setCollectOpen(true)}>
            <Plus className="ml-1 h-4 w-4" /> سند قبض جديد
          </Button>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab} dir="rtl">
        <TabsList className="w-full">
          <TabsTrigger value="statement" className="flex-1">الحالات</TabsTrigger>
          <TabsTrigger value="payments" className="flex-1">المدفوعات</TabsTrigger>
        </TabsList>
        <TabsContent value="statement" className="space-y-1.5 mt-3">
          {(ledger?.cases ?? []).map((c) => (
            <Card key={c.id} className="p-2.5 flex items-center justify-between">
              <div>
                <p className="font-mono text-xs text-muted-foreground">{c.case_number}</p>
                <p className="text-xs">{format(new Date(c.date_received), "yyyy-MM-dd")}</p>
              </div>
              <p className="font-mono font-semibold">{Number(c.price ?? 0).toFixed(2)}</p>
            </Card>
          ))}
          {(ledger?.cases ?? []).length === 0 && <p className="text-center text-sm text-muted-foreground py-6">لا توجد حالات</p>}
        </TabsContent>
        <TabsContent value="payments" className="space-y-1.5 mt-3">
          {(ledger?.payments ?? []).map((p) => (
            <Card key={p.id} className="p-2.5 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{p.method ?? "—"}</p>
                <p className="text-xs">{format(new Date(p.payment_date), "yyyy-MM-dd")}</p>
              </div>
              <p className="font-mono font-semibold text-primary">{Number(p.amount ?? 0).toFixed(2)}</p>
            </Card>
          ))}
          {(ledger?.payments ?? []).length === 0 && <p className="text-center text-sm text-muted-foreground py-6">لا توجد مدفوعات</p>}
        </TabsContent>
      </Tabs>

      {collectOpen && doctor && (
        <CollectDialog doctorId={doctor.id} doctorName={doctor.name} onClose={() => setCollectOpen(false)} />
      )}
    </div>
  );
}

function CollectDialog({ doctorId, doctorName, onClose }: { doctorId: string; doctorName: string; onClose: () => void }) {
  const { user } = useAuth();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  useState(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => {},
      );
    }
  });

  const submit = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(amount);
      if (!amt || amt <= 0) throw new Error("أدخل مبلغ صحيح");
      const { data: agent } = await supabase.from("delivery_agents").select("id, lab_id").eq("user_id", user!.id).maybeSingle();
      if (!agent) throw new Error("حساب المندوب غير موجود");
      const { error } = await supabase.from("pending_payments").insert({
        lab_id: agent.lab_id,
        agent_id: agent.id,
        doctor_id: doctorId,
        amount: amt,
        method,
        reference: reference || null,
        notes: notes || null,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("أُرسل السند للمراجعة"); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur flex items-end md:items-center justify-center p-3" dir="rtl" onClick={onClose}>
      <Card className="w-full max-w-md p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" />سند قبض من د. {doctorName}</h3>
        <div>
          <Label>المبلغ *</Label>
          <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} dir="ltr" placeholder="0.00" />
        </div>
        <div>
          <Label>طريقة الدفع</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">نقدي</SelectItem>
              <SelectItem value="bank">تحويل بنكي</SelectItem>
              <SelectItem value="instapay">إنستاباي</SelectItem>
              <SelectItem value="vodafone_cash">فودافون كاش</SelectItem>
              <SelectItem value="other">أخرى</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>مرجع (اختياري)</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} /></div>
        <div><Label>ملاحظات</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        {coords && <p className="text-xs text-muted-foreground">📍 سيتم تسجيل الموقع</p>}
        <p className="text-xs text-muted-foreground bg-muted p-2 rounded">سيظهر السند للمحاسب للمراجعة قبل أن يُسجّل في حساب الطبيب.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">إلغاء</Button>
          <Button onClick={() => submit.mutate()} disabled={submit.isPending} className="flex-1">إرسال</Button>
        </div>
      </Card>
    </div>
  );
}
