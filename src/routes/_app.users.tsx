import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/users")({
  component: UsersPage,
});

function UsersPage() {
  const { labId } = useAuth();
  const { data: users } = useQuery({
    queryKey: ["lab-users", labId],
    enabled: !!labId,
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("*").eq("lab_id", labId!);
      const { data: roles } = await supabase.from("user_roles").select("user_id, role").eq("lab_id", labId!);
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role),
      }));
    },
  });

  const { data: roles } = useQuery({
    queryKey: ["lab-roles", labId],
    enabled: !!labId,
    queryFn: async () => (await supabase.from("roles").select("*").eq("lab_id", labId!)).data ?? [],
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">المستخدمون والأدوار</h1>
        <p className="text-sm text-muted-foreground">إدارة فريق المعمل</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">الأعضاء</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {users?.map((u) => (
            <div key={u.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">{u.full_name ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{u.phone ?? ""}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {u.roles.map((r) => (
                  <Badge key={r} variant="secondary">{r === "admin" ? "مدير" : r === "manager" ? "مشرف" : "فني"}</Badge>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">الأدوار المعرّفة</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {roles?.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">{r.name}</p>
                {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
              </div>
              {r.is_system && <Badge>نظام</Badge>}
            </div>
          ))}
        </CardContent>
      </Card>
      <p className="text-center text-xs text-muted-foreground">دعوة مستخدمين جدد ستتاح في التحديث القادم</p>
    </div>
  );
}
