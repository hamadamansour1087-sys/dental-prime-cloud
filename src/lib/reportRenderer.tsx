import { createRoot } from "react-dom/client";
import type { ReactElement } from "react";
import { exportElementToPdf } from "@/lib/pdf";

/**
 * Renders a React element off-screen, exports it to PDF, then cleans up.
 * Ensures fonts/images load before capturing.
 */
export async function renderReportToPdf(element: ReactElement, fileName: string) {
  const host = document.createElement("div");
  host.dir = "rtl";
  host.lang = "ar";
  host.style.position = "fixed";
  host.style.left = "0";
  host.style.top = "0";
  host.style.width = "210mm";
  host.style.zIndex = "-1";
  host.style.opacity = "0";
  host.style.pointerEvents = "none";
  host.style.background = "#ffffff";
  document.body.appendChild(host);

  const root = createRoot(host);
  root.render(element);

  // Wait for paint + fonts + images
  await new Promise((r) => setTimeout(r, 150));
  if ((document as any).fonts?.ready) {
    try { await (document as any).fonts.ready; } catch { /* noop */ }
  }
  const imgs = Array.from(host.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) =>
      img.complete && img.naturalWidth > 0
        ? Promise.resolve()
        : new Promise((res) => { img.onload = res; img.onerror = res; setTimeout(res, 3000); })
    )
  );
  await new Promise((r) => setTimeout(r, 100));

  try {
    const target = host.firstElementChild as HTMLElement;
    if (!target) throw new Error("Report element not rendered");
    await exportElementToPdf(target, fileName);
  } finally {
    root.unmount();
    host.remove();
  }
}
