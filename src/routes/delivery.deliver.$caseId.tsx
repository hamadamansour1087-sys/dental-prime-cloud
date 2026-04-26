import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MapPin, CheckCircle2, Eraser, ArrowRight, RefreshCw, Phone, Calendar, Stethoscope, FileText } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/delivery/deliver/$caseId")({
  component: DeliverPage,
});

function DeliverPage() {
  const { caseId } = Route.useParams();
  const navigate = useNavigate();
  const [recipientName, setRecipientName] = useState("");
  const [notes, setNotes] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasSignature = useRef(false);

  const { data: caseRow } = useQuery({
    queryKey: ["deliver-case", caseId],
    queryFn: async () => {
      const { data } = await supabase.from("cases")
        .select(`
          id, case_number, date_received, due_date, tooth_numbers, units, shade, notes, price,
          doctors(name, clinic_name, phone, governorate, address),
          work_types(name),
          case_items(id, units, shade, tooth_numbers, total_price, notes, work_types(name))
        `)
        .eq("id", caseId).maybeSingle();
      return data;
    },
  });

  const requestLocation = () => {
    if (!navigator.geolocation) { setGpsError("المتصفح لا يدعم تحديد الموقع"); return; }
    setGpsLoading(true); setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy });
        setGpsLoading(false);
        toast.success("تم تحديد الموقع");
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError("تم رفض إذن الموقع. فعّله من إعدادات المتصفح ثم أعد المحاولة.");
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGpsError("الموقع غير متاح حالياً.");
        } else if (err.code === err.TIMEOUT) {
          setGpsError("انتهت مهلة تحديد الموقع.");
        } else {
          setGpsError(err.message);
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  };

  // Auto-request on mount
  useEffect(() => { requestLocation(); }, []);

  // Setup canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
  }, []);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true; hasSignature.current = true;
    const { x, y } = getPoint(e);
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.beginPath(); ctx.moveTo(x, y);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const { x, y } = getPoint(e);
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.lineTo(x, y); ctx.stroke();
  };
  const end = () => { drawing.current = false; };
  const clearSig = () => {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    hasSignature.current = false;
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (!hasSignature.current) throw new Error("التوقيع مطلوب لتأكيد التسليم");

      // Upload signature
      const canvas = canvasRef.current!;
      const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/png"));
      const path = `${caseId}/${Date.now()}.png`;
      const { error: upErr } = await supabase.storage.from("delivery-signatures").upload(path, blob, {
        contentType: "image/png", upsert: false,
      });
      if (upErr) throw new Error("فشل رفع التوقيع: " + upErr.message);

      const { data, error } = await supabase.rpc("deliver_case_by_agent", {
        _case_id: caseId,
        _latitude: coords?.lat,
        _longitude: coords?.lng,
        _accuracy: coords?.acc,
        _signature_path: path,
        _recipient_name: recipientName || undefined,
        _notes: notes || undefined,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      toast.success("تم تسجيل التسليم بنجاح");
      navigate({ to: "/delivery/dashboard" });
    },
    onError: (e: Error) => { toast.error(e.message); },
  });

  const doctor = caseRow?.doctors as any;
  const items = (caseRow?.case_items as any[]) ?? [];

  return (
    <div className="space-y-3 pb-4" dir="rtl">
      <h1 className="text-xl font-bold">تأكيد التسليم</h1>

      {caseRow && (
        <Card className="p-3 space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-mono text-xs text-muted-foreground">{caseRow.case_number}</p>
              <p className="font-semibold flex items-center gap-1.5">
                <Stethoscope className="h-4 w-4 text-primary" />{doctor?.name}
              </p>
              {doctor?.clinic_name && <p className="text-xs text-muted-foreground">{doctor.clinic_name}</p>}
            </div>
            {caseRow.price != null && (
              <Badge variant="secondary" className="font-mono">{Number(caseRow.price).toFixed(0)} ج.م</Badge>
            )}
          </div>

          <div className="text-xs text-muted-foreground space-y-1 border-t pt-2">
            {doctor?.governorate && (
              <p className="flex items-start gap-1"><MapPin className="h-3 w-3 mt-0.5" />
                {doctor.governorate}{doctor.address ? ` — ${doctor.address}` : ""}
              </p>
            )}
            {doctor?.phone && (
              <a href={`tel:${doctor.phone}`} className="flex items-center gap-1 text-primary" dir="ltr">
                <Phone className="h-3 w-3" />{doctor.phone}
              </a>
            )}
            <p className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              استُلمت {format(new Date(caseRow.date_received), "yyyy-MM-dd")}
              {caseRow.due_date && ` — التسليم ${format(new Date(caseRow.due_date), "yyyy-MM-dd")}`}
            </p>
          </div>

          {(items.length > 0 || caseRow.tooth_numbers || caseRow.shade) && (
            <div className="border-t pt-2 space-y-1">
              <p className="text-xs font-semibold flex items-center gap-1">
                <FileText className="h-3 w-3" />تفاصيل العمل
              </p>
              {items.length > 0 ? (
                <ul className="text-xs space-y-1">
                  {items.map((it) => (
                    <li key={it.id} className="flex justify-between gap-2 bg-muted/40 rounded px-2 py-1">
                      <span>
                        {it.work_types?.name ?? "—"}
                        {it.units > 1 && ` × ${it.units}`}
                        {it.tooth_numbers && ` (${it.tooth_numbers})`}
                        {it.shade && ` — لون ${it.shade}`}
                      </span>
                      {it.total_price != null && <span className="font-mono">{Number(it.total_price).toFixed(0)}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {(caseRow.work_types as any)?.name}
                  {caseRow.units && caseRow.units > 1 && ` × ${caseRow.units}`}
                  {caseRow.tooth_numbers && ` — أسنان: ${caseRow.tooth_numbers}`}
                  {caseRow.shade && ` — لون: ${caseRow.shade}`}
                </p>
              )}
              {caseRow.notes && (
                <p className="text-xs text-muted-foreground italic border-r-2 border-primary/40 pr-2 mt-1">
                  {caseRow.notes}
                </p>
              )}
            </div>
          )}
        </Card>
      )}

      <Card className="p-3">
        <div className="flex items-start gap-2">
          <MapPin className={`h-4 w-4 mt-0.5 ${coords ? "text-success" : "text-muted-foreground"}`} />
          <div className="flex-1 min-w-0">
            {coords ? (
              <div className="text-xs">
                <p className="font-medium text-success">تم تسجيل الموقع</p>
                <p className="text-muted-foreground" dir="ltr">{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)} (±{Math.round(coords.acc)}م)</p>
              </div>
            ) : gpsError ? (
              <div className="text-xs space-y-1">
                <p className="text-destructive">{gpsError}</p>
                <p className="text-muted-foreground">الموقع اختياري — يمكنك التسليم بدونه</p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{gpsLoading ? "جارٍ تحديد الموقع..." : "لم يُحدّد الموقع بعد"}</p>
            )}
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={requestLocation} disabled={gpsLoading}>
            <RefreshCw className={`h-3 w-3 ${gpsLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </Card>

      <div>
        <Label>اسم المستلم (اختياري)</Label>
        <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="د. ..." />
      </div>

      <div>
        <Label>ملاحظات (اختياري)</Label>
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <Label>توقيع المستلم *</Label>
          <Button type="button" size="sm" variant="ghost" onClick={clearSig}><Eraser className="h-3 w-3 ml-1" />مسح</Button>
        </div>
        <div className="rounded-lg border-2 border-dashed bg-muted/30">
          <canvas ref={canvasRef}
            className="w-full h-48 touch-none cursor-crosshair"
            onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end} />
        </div>
        <p className="text-xs text-muted-foreground mt-1">وقّع بإصبعك على المربع</p>
      </div>

      <Button className="w-full" size="lg" disabled={submit.isPending} onClick={() => submit.mutate()}>
        <CheckCircle2 className="ml-2 h-5 w-5" />
        {submit.isPending ? "جارٍ التسجيل..." : "تأكيد التسليم"}
        <ArrowRight className="mr-2 h-4 w-4" />
      </Button>

      <Button asChild variant="ghost" className="w-full" size="sm">
        <Link to="/delivery/dashboard">إلغاء والعودة</Link>
      </Button>
    </div>
  );
}
