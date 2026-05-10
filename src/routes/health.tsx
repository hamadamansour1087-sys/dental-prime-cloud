import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, RefreshCw, Activity } from "lucide-react";

export const Route = createFileRoute("/health")({
  component: HealthPage,
  head: () => ({
    meta: [
      { title: "حالة الخادم | Health Check" },
      { name: "description", content: "فحص حالة اتصال الخادم وقاعدة البيانات والمصادقة." },
    ],
  }),
});

type CheckResult = { ok: boolean; latencyMs: number; error?: string };
type HealthResponse = {
  status: "healthy" | "degraded";
  timestamp: string;
  uptimeMs: number;
  checks: Record<string, CheckResult>;
};

async function fetchHealth(): Promise<{ http: number; data: HealthResponse | null; error?: string }> {
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    const text = await res.text();
    let data: HealthResponse | null = null;
    try { data = JSON.parse(text) as HealthResponse; } catch { /* ignore */ }
    return { http: res.status, data };
  } catch (e) {
    return { http: 0, data: null, error: (e as Error).message };
  }
}

function HealthPage() {
  const { data, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 15_000,
  });

  const httpOk = data?.http && data.http >= 200 && data.http < 300;
  const overall = data?.data?.status ?? (data?.error ? "unreachable" : "loading");

  return (
    <div className="container mx-auto max-w-3xl p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">حالة الخادم</h1>
        </div>
        <Button onClick={() => refetch()} disabled={isFetching} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          تحديث
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>الحالة العامة</span>
            <Badge variant={overall === "healthy" ? "default" : overall === "degraded" ? "secondary" : "destructive"}>
              {overall === "healthy" ? "سليم" : overall === "degraded" ? "متدهور" : overall === "loading" ? "جاري الفحص..." : "غير متاح"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">HTTP Status</span>
            <span className={`font-mono font-semibold ${httpOk ? "text-green-600" : "text-destructive"}`}>
              {data?.http ?? "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">آخر فحص</span>
            <span className="font-mono">{dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("ar-EG") : "—"}</span>
          </div>
          {data?.error && (
            <div className="text-destructive text-xs mt-2 break-all">خطأ: {data.error}</div>
          )}
        </CardContent>
      </Card>

      {data?.data?.checks && (
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(data.data.checks).map(([name, c]) => (
            <Card key={name}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold capitalize">{name}</span>
                  {c.ok ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive" />
                  )}
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>زمن الاستجابة: <span className="font-mono">{c.latencyMs}ms</span></div>
                  {c.error && <div className="text-destructive break-all">{c.error}</div>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        يتم التحديث تلقائياً كل 15 ثانية. Endpoint: <code className="font-mono">/api/health</code>
      </p>
    </div>
  );
}
