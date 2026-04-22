import { useState } from "react";
import { Sparkles, Loader2, AlertTriangle, ArrowRight, Clock, Flame } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Analysis = {
  summary: string;
  priority: "low" | "medium" | "high" | "urgent";
  risks: string[];
  next_action: string;
  estimated_completion_days?: number;
};

const PRIORITY_STYLE: Record<Analysis["priority"], { label: string; class: string }> = {
  low: { label: "منخفضة", class: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  medium: { label: "متوسطة", class: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  high: { label: "عالية", class: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  urgent: { label: "عاجلة", class: "bg-red-500/15 text-red-700 dark:text-red-300" },
};

export function CaseAIAnalysis({ caseData }: { caseData: any }) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/ai-analyze-case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseData }),
      });
      if (!resp.ok) {
        if (resp.status === 429) toast.error("تم تجاوز الحد، حاول لاحقاً");
        else if (resp.status === 402) toast.error("نفد رصيد الذكاء الاصطناعي");
        else toast.error("فشل التحليل");
        return;
      }
      const json = await resp.json();
      setAnalysis(json.analysis);
    } catch {
      toast.error("خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          تحليل ذكي للحالة
        </CardTitle>
        <Button size="sm" variant={analysis ? "outline" : "default"} onClick={run} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin" /> جارِ التحليل...
            </>
          ) : analysis ? (
            "إعادة التحليل"
          ) : (
            "تحليل الآن"
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {!analysis && !loading && (
          <p className="py-2 text-sm text-muted-foreground">
            اضغط "تحليل الآن" للحصول على ملخص ذكي، تقييم الأولوية، والإجراء التالي المقترح.
          </p>
        )}
        {analysis && (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${PRIORITY_STYLE[analysis.priority].class}`}>
                <Flame className="h-3 w-3" /> أولوية {PRIORITY_STYLE[analysis.priority].label}
              </span>
              {analysis.estimated_completion_days != null && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
                  <Clock className="h-3 w-3" /> {analysis.estimated_completion_days} يوم متوقع
                </span>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">الملخص</p>
              <p className="mt-0.5">{analysis.summary}</p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                <ArrowRight className="h-3 w-3" /> الإجراء التالي
              </p>
              <p className="mt-0.5 font-medium text-primary">{analysis.next_action}</p>
            </div>
            {analysis.risks.length > 0 && (
              <div>
                <p className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                  <AlertTriangle className="h-3 w-3" /> تنبيهات ومخاطر
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pr-4 text-xs">
                  {analysis.risks.map((r, i) => (
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
