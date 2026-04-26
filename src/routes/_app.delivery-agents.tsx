import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Truck, Phone, Mail, KeyRound, Copy, Trash2, MapPin, Route as RouteIcon } from "lucide-react";
import { toast } from "sonner";
import { EGYPT_GOVERNORATES } from "@/lib/governorates";

export const Route = createFileRoute("/_app/delivery-agents")({
  component: DeliveryAgentsPage,
});

function DeliveryAgentsPage() {
  const { labId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", route_id: "", governorates: [] as string[], notes: "" });

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ["delivery-agents", labId],
    enabled: !!labId,
    queryFn: async () => {
      const { data } = await supabase
        .from("delivery_agents")
        .select("*, delivery_routes(name)")
        .eq("lab_id", labId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: routes = [] } = useQuery({
    queryKey: ["delivery-routes", labId],
    enabled: !!labId,
    queryFn: async () => {
      const { data } = await supabase.from("delivery_routes").select("id, name").eq("lab_id", labId!).order("name");
      return data ?? [];
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!form.name) throw new Error("الاسم مطلوب");
      const { error } = await supabase.from("delivery_agents").insert({
        lab_id: labId!,
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        route_id: form.route_id || null,
        governorates: form.governorates,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت إضافة المندوب");
      setOpen(false);
      setForm({ name: "", phone: "", email: "", route_id: "", governorates: [], notes: "" });
      qc.invalidateQueries({ queryKey: ["delivery-agents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("delivery_agents").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["delivery-agents"] }),
  });

  const deleteAgent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("delivery_agents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["delivery-agents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createAccount = async (agentId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return toast.error("جلسة غير صالحة");
    const res = await fetch("/api/create-delivery-agent-account", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ agent_id: agentId }),
    });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error ?? "فشل");
    toast.success(`تم إنشاء الحساب — كلمة السر: ${data.password}`);
    qc.invalidateQueries({ queryKey: ["delivery-agents"] });
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">المندوبون</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="ml-1 h-4 w-4" /> مندوب جديد</Button>
          </DialogTrigger>
          <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto max-w-lg">
            <DialogHeader><DialogTitle>إضافة مندوب</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>الاسم *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>الموبايل</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" /></div>
                <div><Label>البريد</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" /></div>
              </div>
              <div>
                <Label>خط السير</Label>
                <Select value={form.route_id || "none"} onValueChange={(v) => setForm({ ...form, route_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="بدون" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون</SelectItem>
                    {routes.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>المحافظات المسؤول عنها</Label>
                <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto rounded border p-2">
                  {EGYPT_GOVERNORATES.map((g) => (
                    <label key={g} className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <Checkbox
                        checked={form.governorates.includes(g)}
                        onCheckedChange={(v) => setForm({
                          ...form,
                          governorates: v ? [...form.governorates, g] : form.governorates.filter((x) => x !== g),
                        })}
                      />
                      {g}
                    </label>
                  ))}
                </div>
              </div>
              <div><Label>ملاحظات</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>حفظ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-8">جارٍ التحميل...</div>
      ) : agents.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">لا يوجد مندوبون بعد</Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {agents.map((a: any) => (
            <Card key={a.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    {a.name}
                    {!a.is_active && <Badge variant="secondary">معطّل</Badge>}
                    {a.user_id && <Badge variant="default" className="text-xs">له حساب</Badge>}
                  </h3>
                  {a.delivery_routes?.name && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <RouteIcon className="h-3 w-3" /> {a.delivery_routes.name}
                    </p>
                  )}
                </div>
                <Switch checked={a.is_active} onCheckedChange={(v) => toggleActive.mutate({ id: a.id, is_active: v })} />
              </div>
              <div className="text-xs space-y-1 text-muted-foreground">
                {a.phone && <p className="flex items-center gap-1.5" dir="ltr"><Phone className="h-3 w-3" />{a.phone}</p>}
                {a.email && <p className="flex items-center gap-1.5" dir="ltr"><Mail className="h-3 w-3" />{a.email}</p>}
                {a.governorates?.length > 0 && (
                  <p className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{a.governorates.join("، ")}</p>
                )}
                {generatedPasswords[a.id] && (
                  <p className="flex items-center gap-1.5 font-mono text-foreground bg-muted px-2 py-1 rounded">
                    <KeyRound className="h-3 w-3" />{generatedPasswords[a.id]}
                    <button onClick={() => { navigator.clipboard.writeText(generatedPasswords[a.id]); toast.success("تم النسخ"); }}
                      className="mr-auto"><Copy className="h-3 w-3" /></button>
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {!a.user_id && a.phone && (
                  <Button size="sm" variant="outline" onClick={() => createAccount(a.id)}>
                    <KeyRound className="ml-1 h-3 w-3" /> إنشاء حساب
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="text-destructive ml-auto"
                  onClick={() => { if (confirm(`حذف المندوب ${a.name}؟`)) deleteAgent.mutate(a.id); }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
