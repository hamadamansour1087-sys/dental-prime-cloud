import { Card, CardContent } from "@/components/ui/card";
import type { LabRow } from "./types";

interface Props {
  labs: LabRow[] | undefined;
  pendingCount: number;
}

export function StatsCards({ labs, pendingCount }: Props) {
  const total = labs?.length ?? 0;
  const active = labs?.filter((l) => l.subscription_status === "active").length ?? 0;
  const trial = labs?.filter((l) => l.subscription_status === "trial").length ?? 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <Card className="bg-white/5 border-white/10 text-white">
        <CardContent className="py-4 text-center">
          <p className="text-3xl font-bold">{total}</p>
          <p className="text-xs text-slate-400 mt-1">إجمالي المعامل</p>
        </CardContent>
      </Card>
      <Card className="bg-white/5 border-white/10 text-white">
        <CardContent className="py-4 text-center">
          <p className="text-3xl font-bold text-emerald-400">{active}</p>
          <p className="text-xs text-slate-400 mt-1">مفعّل</p>
        </CardContent>
      </Card>
      <Card className="bg-white/5 border-white/10 text-white">
        <CardContent className="py-4 text-center">
          <p className="text-3xl font-bold text-amber-400">{trial}</p>
          <p className="text-xs text-slate-400 mt-1">تجريبي</p>
        </CardContent>
      </Card>
      <Card className="bg-amber-500/10 border-amber-500/30 text-white">
        <CardContent className="py-4 text-center">
          <p className="text-3xl font-bold text-amber-300">{pendingCount}</p>
          <p className="text-xs text-amber-300/70 mt-1">طلبات بانتظار المراجعة</p>
        </CardContent>
      </Card>
    </div>
  );
}
