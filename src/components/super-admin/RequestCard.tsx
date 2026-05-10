import { format } from "date-fns";
import { Building2, Calendar, CheckCircle2, Mail, MapPin, Phone, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RequestStatusBadge } from "./badges";
import type { LabRequest } from "./types";

interface Props {
  request: LabRequest;
  onApprove: (req: LabRequest) => void;
  onReject: (req: LabRequest) => void;
}

export function RequestCard({ request: req, onApprove, onReject }: Props) {
  return (
    <Card className="bg-white/5 border-white/10 text-white">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            {req.lab_name}
          </CardTitle>
          <RequestStatusBadge status={req.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="font-medium">{req.owner_name}</p>
        {req.email && (
          <p className="flex items-center gap-1.5 text-slate-400">
            <Mail className="h-3.5 w-3.5" />
            {req.email}
          </p>
        )}
        {req.phone && (
          <p className="flex items-center gap-1.5 text-slate-400">
            <Phone className="h-3.5 w-3.5" />
            {req.phone}
          </p>
        )}
        {req.address && (
          <p className="flex items-center gap-1.5 text-slate-400">
            <MapPin className="h-3.5 w-3.5" />
            {req.address}
          </p>
        )}
        <p className="flex items-center gap-1.5 text-slate-400">
          <Calendar className="h-3.5 w-3.5" />
          {format(new Date(req.created_at), "dd/MM/yyyy HH:mm")}
        </p>
        {req.notes && <p className="text-xs text-slate-400 bg-white/5 rounded p-2">{req.notes}</p>}
        {req.rejection_reason && (
          <p className="text-xs text-destructive bg-destructive/10 rounded p-2">
            سبب الرفض: {req.rejection_reason}
          </p>
        )}
        {req.status === "pending" && (
          <div className="flex gap-2 pt-2">
            <Button size="sm" className="flex-1" onClick={() => onApprove(req)}>
              <CheckCircle2 className="h-4 w-4 ml-1" /> موافقة
            </Button>
            <Button size="sm" variant="destructive" className="flex-1" onClick={() => onReject(req)}>
              <XCircle className="h-4 w-4 ml-1" /> رفض
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
