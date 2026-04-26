import { useState } from "react";
import { Sparkles, Loader2, AlertTriangle, Lightbulb, Activity, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Alert = { level: "info" | "warning" | "critical"; message: string };
type Insights = {
  headline: string;
  summary: string;
  health_score: number;
  alerts: Alert[];
  recommendations: string[];
};

const ALERT_STYLE: Record<Alert["level"], string> = {
  info: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  critical: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
};

export function DailyInsightsWidget({ stats }: { stats: any }) {
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch("/api/ai-daily-insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ stats }),
      });
      if (!resp.ok) {
        if (resp.status === 429) toast.error("تم تجاوز الحد، حاول لاحقاً");
        else if (resp.status === 402) toast.error("نفد رصيد الذكاء الاصطناعي");
        else toast.error("فشل التوليد");
        return;
      }
      const json = await resp.json();
      setInsights(json.insights);
    } catch {
      toast.error("خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = insights
    ? insights.health_score >= 75
      ? "text-emerald-600 dark:text-emerald-400"
      : insights.health_score >= 50
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400"
    : "";

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-transparent shadow-elegant">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          ملخص اليوم الذكي
        </CardTitle>
        <Button size="sm" variant={insights ? "outline" : "default"} onClick={run} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" /> جارِ التحليل...
            </>
          ) : insights ? (
            "تحديث"
          ) : (
            "توليد ملخص"
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {!insights && !loading && (
          <p className="py-4 text-sm text-muted-foreground">
            احصل على ملخص ذكي لأداء معملك اليوم، تنبيهات بالمشاكل، وتوصيات قابلة للتنفيذ.
          </p>
        )}
        {insights && (
          <div className="space-y-4">
            {/* Headline + score */}
            <div className="rounded-lg border bg-card/50 p-4">
              <div className="mb-2 flex items-start justify-between gap-3">
                <p className="flex-1 text-sm font-semibold leading-relaxed">{insights.headline}</p>
                <div className="shrink-0 text-center">
                  <div className={`text-2xl font-bold ${scoreColor}`}>{insights.health_score}</div>
                  <div className="text-[10px] text-muted-foreground">درجة الصحة</div>
                </div>
              </div>
              <Progress value={insights.health_score} className="h-1.5" />
              <p className="mt-3 text-sm text-muted-foreground">{insights.summary}</p>
            </div>

            {/* Alerts */}
            {insights.alerts.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                  <AlertTriangle className="h-3.5 w-3.5" /> التنبيهات
                </p>
                <div className="space-y-1.5">
                  {insights.alerts.map((a, i) => (
                    <div key={i} className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${ALERT_STYLE[a.level]}`}>
                      <Activity className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>{a.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {insights.recommendations.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                  <Lightbulb className="h-3.5 w-3.5" /> التوصيات
                </p>
                <ul className="space-y-1.5">
                  {insights.recommendations.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs">
                      <TrendingUp className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
