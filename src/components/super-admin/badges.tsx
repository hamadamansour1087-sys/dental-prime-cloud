import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, XCircle } from "lucide-react";

export function RequestStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "pending":
      return (
        <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20">
          <Clock className="h-3 w-3 ml-1" />
          بانتظار المراجعة
        </Badge>
      );
    case "approved":
      return (
        <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20">
          <CheckCircle2 className="h-3 w-3 ml-1" />
          تمت الموافقة
        </Badge>
      );
    case "rejected":
      return (
        <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/5">
          <XCircle className="h-3 w-3 ml-1" />
          مرفوض
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function SubscriptionBadge({ status }: { status: string }) {
  switch (status) {
    case "trial":
      return <Badge className="bg-amber-500/10 text-amber-600 border-amber-300 hover:bg-amber-500/20">تجريبي</Badge>;
    case "active":
      return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-300 hover:bg-emerald-500/20">مفعّل</Badge>;
    case "expired":
      return <Badge className="bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20">منتهي / موقوف</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
