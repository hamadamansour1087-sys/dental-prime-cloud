import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, CheckCircle2, Eraser, ArrowRight } from "lucide-react";
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
  const [submitting, setSubmitting] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasSignature = useRef(false);

  const { data: caseRow } = useQuery({
    queryKey: ["deliver-case", caseId],
    queryFn: async () => {
      const { data } = await supabase.from("cases")
        .select("id, case_number, doctors(name, clinic_name, phone, governorate, address)")
        .eq("id", caseId).maybeSingle();
      return data;
    },
  });

  // Capture GPS on mount
  useEffect(() => {
    if (!navigator.geolocation) { setGpsError("المتصفح لا يدعم الموقع"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy }),
      (err) => setGpsError(err.message),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }, []);

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
      if (!hasSignature.current) throw new Error("التوقيع مطلوب");
      setSubmitting(true);

      // Upload signature
      const canvas = canvasRef.current!;
      const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/png"));
      const path = `${caseId}/${Date.now()}.png`;
      const { error: upErr } = await supabase.storage.from("delivery-signatures").upload(path, blob, {
        contentType: "image/png", upsert: false,
      });
      if (upErr) throw upErr;

      const { data, error } = await supabase.rpc("deliver_case_by_agent", {
        _case_id: caseId,
        _latitude: coords?.lat,
        _longitude: coords?.lng,
        _accuracy: coords?.acc,
        _signature_path: path,
        _recipient_name: recipientName || undefined,
        _notes: notes || undefined,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("تم تسجيل التسليم");
      navigate({ to: "/delivery/dashboard" });
    },
    onError: (e: Error) => { setSubmitting(false); toast.error(e.message); },
  });

  return (
    <div className="space-y-3" dir="rtl">
      <h1 className="text-xl font-bold">تأكيد التسليم</h1>
      {caseRow && (
        <Card className="p-3">
          <p className="font-mono text-xs text-muted-foreground">{caseRow.case_number}</p>
          <p className="font-semibold">{(caseRow.doctors as any)?.name}</p>
          {(caseRow.doctors as any)?.clinic_name && <p className="text-xs text-muted-foreground">{(caseRow.doctors as any).clinic_name}</p>}
        </Card>
      )}

      <Card className="p-3 text-sm flex items-start gap-2">
        <MapPin className="h-4 w-4 text-primary mt-0.5" />
        {coords ? (
          <div className="text-xs text-muted-foreground">
            <p>تم تسجيل الموقع</p>
            <p dir="ltr">{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)} (±{Math.round(coords.acc)}م)</p>
          </div>
        ) : gpsError ? (
          <p className="text-xs text-destructive">تعذّر الموقع: {gpsError}</p>
        ) : (
          <p className="text-xs text-muted-foreground">جارٍ تحديد الموقع...</p>
        )}
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

      <Button className="w-full" size="lg" disabled={submitting || submit.isPending} onClick={() => submit.mutate()}>
        <CheckCircle2 className="ml-2 h-5 w-5" />
        {submit.isPending ? "جارٍ التسجيل..." : "تأكيد التسليم"}
        <ArrowRight className="mr-2 h-4 w-4" />
      </Button>
    </div>
  );
}
