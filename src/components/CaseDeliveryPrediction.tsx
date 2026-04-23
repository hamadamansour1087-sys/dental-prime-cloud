import { useState } from "react";
import { CalendarClock, Loader2, Target, AlertCircle, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

type Prediction = {
  estimated_days_remaining: number;
  confidence: "low" | "medium" | "high";
  on_time_probability: number;
  reasoning: string;
  risk_factors: string[];
};

const CONFIDENCE_LABEL: Record<Prediction["confidence"], string> = {
  low: "ثقة منخفضة",
  medium: "ثقة متوسطة",
  high: "ثقة عالية",
};

export function CaseDeliveryPrediction({ caseData }: { caseData: any }) {
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/ai-predict-delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseData }),
      });
      if (!resp.ok) {
        if (resp.status === 429) toast.error("تم تجاوز الحد، حاول لاحقاً");
        else if (resp.status === 402) toast.error("نفد رصيد الذكاء الاصطناعي");
        else toast.error("فشل التوقع");
        return;
      }
      const json = await resp.json();
      setPrediction(json.prediction);
    } catch {
      toast.error("خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  const probColor = prediction
    ? prediction.on_time_probability >= 75
      ? "text-emerald-600 dark:text-emerald-400"
      : prediction.on_time_probability >= 50
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400"
    : "";

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4 text-primary" />
          توقع موعد التسليم بالذكاء الاصطناعي
        </CardTitle>
        <Button size="sm" variant={prediction ? "outline" : "default"} onClick={run} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" /> جارِ التوقع...
            </>
          ) : prediction ? (
            "إعادة التوقع"
          ) : (
            <>
              <Sparkles className="ml-1 h-3.5 w-3.5" /> توقع
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {!prediction && !loading && (
          <p className="py-2 text-sm text-muted-foreground">
            اضغط "توقع" للحصول على تقدير ذكي لموعد التسليم واحتمالية الالتزام بالموعد المحدد.
          </p>
        )}
        {prediction && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-card/50 p-3 text-center">
                <p className="text-[11px] text-muted-foreground">الأيام المتبقية</p>
                <p className="mt-1 text-2xl font-bold text-primary">{prediction.estimated_days_remaining}</p>
                <p className="text-[10px] text-muted-foreground">{CONFIDENCE_LABEL[prediction.confidence]}</p>
              </div>
              <div className="rounded-lg border bg-card/50 p-3 text-center">
                <p className="text-[11px] text-muted-foreground">احتمال التسليم في الموعد</p>
                <p className={`mt-1 text-2xl font-bold ${probColor}`}>{prediction.on_time_probability}%</p>
                <Progress value={prediction.on_time_probability} className="mt-1.5 h-1" />
              </div>
            </div>
            <div>
              <p className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                <Target className="h-3 w-3" /> التحليل
              </p>
              <p className="mt-0.5">{prediction.reasoning}</p>
            </div>
            {prediction.risk_factors.length > 0 && (
              <div>
                <p className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                  <AlertCircle className="h-3 w-3" /> عوامل المخاطرة
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pr-4 text-xs">
                  {prediction.risk_factors.map((r, i) => (
                    <li key={i}>{r}</li>
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
