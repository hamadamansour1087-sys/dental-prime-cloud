import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";

export async function exportElementToPdf(element: HTMLElement, fileName: string) {
  const A4_WIDTH_MM = 210;
  const A4_HEIGHT_MM = 297;
  const MARGIN_MM = 8;
  const CONTENT_WIDTH_MM = A4_WIDTH_MM - MARGIN_MM * 2;
  const CONTENT_HEIGHT_MM = A4_HEIGHT_MM - MARGIN_MM * 2;
  const SECTION_GAP_MM = 2;
  const SCALE = 3; // Higher scale for clearer Arabic text

  // Try section-based rendering first
  const sections = Array.from(element.querySelectorAll("[data-pdf-section]")) as HTMLElement[];

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  if (sections.length > 1) {
    let currentY = MARGIN_MM;

    for (const section of sections) {
      const canvas = await html2canvas(section, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        imageSmoothing: true,
        imageSmoothingQuality: "high",
      });

      const scaleFactor = CONTENT_WIDTH_MM / (canvas.width / 2);
      const heightMM = (canvas.height / 2) * scaleFactor;

      const remaining = A4_HEIGHT_MM - MARGIN_MM - currentY;

      if (heightMM > remaining && currentY > MARGIN_MM + 1) {
        pdf.addPage();
        currentY = MARGIN_MM;
      }

      // If a single section is taller than a page, fall back to slicing it
      if (heightMM > CONTENT_HEIGHT_MM) {
        const pageCanvasPx = (CONTENT_HEIGHT_MM / CONTENT_WIDTH_MM) * canvas.width;
        let renderedPx = 0;
        while (renderedPx < canvas.height) {
          const sliceH = Math.min(pageCanvasPx, canvas.height - renderedPx);
          const slice = document.createElement("canvas");
          slice.width = canvas.width;
          slice.height = sliceH;
          const ctx = slice.getContext("2d")!;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, slice.width, slice.height);
          ctx.drawImage(canvas, 0, renderedPx, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
          const sliceData = slice.toDataURL("image/png");
          const sliceMMH = (sliceH / canvas.width) * CONTENT_WIDTH_MM;
          if (renderedPx > 0 || currentY > MARGIN_MM + 1) pdf.addPage();
          currentY = MARGIN_MM;
          pdf.addImage(sliceData, "PNG", MARGIN_MM, currentY, CONTENT_WIDTH_MM, sliceMMH);
          renderedPx += sliceH;
          currentY += sliceMMH;
        }
      } else {
        const imgData = canvas.toDataURL("image/png");
        pdf.addImage(imgData, "PNG", MARGIN_MM, currentY, CONTENT_WIDTH_MM, heightMM);
        currentY += heightMM + SECTION_GAP_MM;
      }
    }
  } else {
    // Fallback: capture entire element as before
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
    const usableWidth = CONTENT_WIDTH_MM;
    const ratio = canvas.height / canvas.width;
    const imgHeight = usableWidth * ratio;

    if (imgHeight <= CONTENT_HEIGHT_MM) {
      pdf.addImage(imgData, "PNG", MARGIN_MM, MARGIN_MM, usableWidth, imgHeight);
    } else {
      const pageCanvasHeightPx = (CONTENT_HEIGHT_MM / usableWidth) * canvas.width;
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
        pdf.addImage(sliceData, "PNG", MARGIN_MM, MARGIN_MM, usableWidth, sliceImgHeight);
        renderedPx += sliceHeight;
      }
    }
  }

  const blob = pdf.output("blob");
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );

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
