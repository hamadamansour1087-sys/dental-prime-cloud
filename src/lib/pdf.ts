import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";

export async function exportElementToPdf(element: HTMLElement, fileName: string) {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    imageSmoothing: true,
    imageSmoothingQuality: "high",
    windowWidth: Math.max(element.scrollWidth, element.clientWidth),
    windowHeight: Math.max(element.scrollHeight, element.clientHeight),
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const usableWidth = pageWidth - margin * 2;
  const ratio = canvas.height / canvas.width;
  const imgHeight = usableWidth * ratio;

  if (imgHeight <= pageHeight - margin * 2) {
    pdf.addImage(imgData, "PNG", margin, margin, usableWidth, imgHeight);
  } else {
    const pageCanvasHeightPx = ((pageHeight - margin * 2) / usableWidth) * canvas.width;
    let renderedPx = 0;
    while (renderedPx < canvas.height) {
      const sliceHeight = Math.min(pageCanvasHeightPx, canvas.height - renderedPx);
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sliceHeight;
      const ctx = slice.getContext("2d");
      if (!ctx) throw new Error("تعذر تجهيز صفحة PDF");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, renderedPx, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
      const sliceData = slice.toDataURL("image/png");
      const sliceImgHeight = (sliceHeight / canvas.width) * usableWidth;
      if (renderedPx > 0) pdf.addPage();
      pdf.addImage(sliceData, "PNG", margin, margin, usableWidth, sliceImgHeight);
      renderedPx += sliceHeight;
    }
  }

  const blob = pdf.output("blob");
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );

  // On mobile: try Web Share API first (works on iOS/Android), then fall back to direct download.
  if (isMobile) {
    try {
      const file = new File([blob], fileName, { type: "application/pdf" });
      const nav = navigator as Navigator & {
        canShare?: (data: { files: File[] }) => boolean;
        share?: (data: { files: File[]; title?: string }) => Promise<void>;
      };
      if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: fileName });
        return;
      }
    } catch {
      /* fall through to download */
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  // Desktop: open in new tab so the browser's PDF viewer shows it.
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
