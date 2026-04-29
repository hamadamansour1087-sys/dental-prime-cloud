import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, RotateCcw, Check, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Called when user confirms a captured photo. Returns a File. */
  onCapture: (file: File) => void;
}

/**
 * Inline camera dialog that uses getUserMedia instead of the native
 * file input `capture` attribute. Avoids the mobile-Chrome behaviour
 * where launching the OS camera can unload the page and lose form state.
 */
export function InlineCameraDialog({ open, onOpenChange, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");

  useEffect(() => {
    if (!open) return;
    setError(null);
    setPreview(null);
    let cancelled = false;
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e: any) {
        setError(e?.message ?? "تعذر فتح الكاميرا");
      }
    };
    start();
    return () => {
      cancelled = true;
      const s = streamRef.current;
      if (s) {
        s.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [open, facing]);

  const snap = () => {
    const video = videoRef.current;
    if (!video) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return toast.error("الكاميرا لم تجهز بعد");
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob(
      (blob) => {
        if (!blob) return toast.error("فشل التقاط الصورة");
        const url = URL.createObjectURL(blob);
        setPreview({ url, blob });
      },
      "image/jpeg",
      0.92,
    );
  };

  const confirm = () => {
    if (!preview) return;
    const file = new File([preview.blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
    onCapture(file);
    URL.revokeObjectURL(preview.url);
    setPreview(null);
    onOpenChange(false);
  };

  const retake = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>التقاط صورة</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-lg border bg-black aspect-[3/4]">
            {preview ? (
              <img src={preview.url} alt="معاينة" className="h-full w-full object-contain" />
            ) : (
              <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
            )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex items-center justify-between gap-2">
            {preview ? (
              <>
                <Button variant="outline" onClick={retake} className="flex-1">
                  <X className="ml-1 h-4 w-4" /> إعادة
                </Button>
                <Button onClick={confirm} className="flex-1">
                  <Check className="ml-1 h-4 w-4" /> استخدام الصورة
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
                  size="icon"
                  title="تبديل الكاميرا"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button onClick={snap} className="flex-1" disabled={!!error}>
                  <Camera className="ml-1 h-4 w-4" /> التقاط
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
