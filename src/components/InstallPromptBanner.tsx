import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPromptBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show in iframe (Lovable preview)
    try {
      if (window.self !== window.top) return;
    } catch {
      return;
    }

    // Check if already dismissed this session
    if (sessionStorage.getItem("pwa-install-dismissed")) {
      setDismissed(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!deferredPrompt || dismissed) return null;

  const install = async () => {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  const dismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("pwa-install-dismissed", "1");
  };

  return (
    <div className="flex items-center justify-between gap-2 bg-primary/10 px-4 py-2 text-sm" dir="rtl">
      <div className="flex items-center gap-2">
        <Download className="h-4 w-4 text-primary" />
        <span>ثبّت التطبيق على هاتفك للوصول السريع</span>
      </div>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="default" className="h-7 text-xs" onClick={install}>
          تثبيت
        </Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={dismiss}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
