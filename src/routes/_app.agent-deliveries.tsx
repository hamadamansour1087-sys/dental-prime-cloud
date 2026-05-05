import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  MapPin,
  Truck,
  Calendar,
  Stethoscope,
  Search,
} from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/agent-deliveries")({
  component: AgentDeliveriesPage,
});

function AgentDeliveriesPage() {
  const { labId } = useAuth();
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return format(d, "yyyy-MM-dd");
  });
  const [dateTo, setDateTo] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [search, setSearch] = useState("");

  const { data: agents = [] } = useQuery({
    queryKey: ["delivery-agents-list", labId],
    enabled: !!labId,
    queryFn: async () => {
      const { data } = await supabase
        .from("delivery_agents")
        .select("id, name")
        .eq("lab_id", labId!)
        .eq("is_active", true)
        .order("name");
      return data ?? [];
    },
  });

  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: [
      "agent-deliveries-lab",
      labId,
      selectedAgent,
      dateFrom,
      dateTo,
    ],
    enabled: !!labId,
    queryFn: async () => {
      let q = supabase
        .from("case_deliveries")
        .select(
          "id, delivered_at, latitude, longitude, location_accuracy, recipient_name, notes, signature_path, agent_id, delivery_agents(name), cases(case_number, doctor_id, doctors(name, clinic_name), patients(name), work_types(name))"
        )
        .eq("lab_id", labId!)
        .gte("delivered_at", `${dateFrom}T00:00:00`)
        .lte("delivered_at", `${dateTo}T23:59:59`)
        .order("delivered_at", { ascending: false });

      if (selectedAgent !== "all") {
        q = q.eq("agent_id", selectedAgent);
      }

      const { data } = await q;
      return data ?? [];
    },
  });

  const filtered = deliveries.filter((d: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      d.cases?.case_number?.toLowerCase().includes(s) ||
      d.cases?.doctors?.name?.toLowerCase().includes(s) ||
      d.cases?.patients?.name?.toLowerCase().includes(s) ||
      d.recipient_name?.toLowerCase().includes(s) ||
      d.delivery_agents?.name?.toLowerCase().includes(s)
    );
  });

  // Summary stats
  const agentSummary = deliveries.reduce(
    (acc: Record<string, number>, d: any) => {
      const name = d.delivery_agents?.name ?? "غير معروف";
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">الحالات المسلّمة بواسطة المندوبين</h1>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <Label>المندوب</Label>
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع المندوبين</SelectItem>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>من تاريخ</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <Label>إلى تاريخ</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <div>
            <Label>بحث</Label>
            <div className="relative">
              <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="رقم الحالة، الطبيب، المستلم..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-8"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-primary">{filtered.length}</p>
          <p className="text-xs text-muted-foreground">إجمالي الحالات المسلّمة</p>
        </Card>
        {Object.entries(agentSummary)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name, count]) => (
            <Card key={name} className="p-3 text-center">
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-xs text-muted-foreground truncate">{name}</p>
            </Card>
          ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <Card className="p-8 text-center text-muted-foreground">
          جارٍ التحميل...
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          لا توجد حالات مسلّمة في هذه الفترة
        </Card>
      ) : (
        <Card className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">رقم الحالة</TableHead>
                <TableHead className="text-right">الطبيب</TableHead>
                <TableHead className="text-right">المريض</TableHead>
                <TableHead className="text-right">نوع العمل</TableHead>
                <TableHead className="text-right">المندوب</TableHead>
                <TableHead className="text-right">المستلم</TableHead>
                <TableHead className="text-right">تاريخ التسليم</TableHead>
                <TableHead className="text-right">الموقع</TableHead>
                <TableHead className="text-right">ملاحظات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-xs">
                    {d.cases?.case_number ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Stethoscope className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm">
                        {d.cases?.doctors?.name ?? "—"}
                      </span>
                    </div>
                    {d.cases?.doctors?.clinic_name && (
                      <p className="text-[10px] text-muted-foreground">
                        {d.cases.doctors.clinic_name}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {d.cases?.patients?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {d.cases?.work_types?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="gap-1">
                      <Truck className="h-3 w-3" />
                      {d.delivery_agents?.name ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {d.recipient_name ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      {format(new Date(d.delivered_at), "yyyy-MM-dd")}
                    </div>
                    <p className="text-muted-foreground text-[10px]">
                      {format(new Date(d.delivered_at), "HH:mm")}
                    </p>
                  </TableCell>
                  <TableCell>
                    {d.latitude && d.longitude ? (
                      <a
                        href={`https://maps.google.com/?q=${d.latitude},${d.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <MapPin className="h-3 w-3" />
                        عرض
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                    {d.notes ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
