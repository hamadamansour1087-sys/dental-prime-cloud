import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/**
 * html2canvas (v1) cannot parse modern CSS color functions like oklch(), oklab(), color().
 * Our design tokens use oklch(), so we sanitize the cloned DOM before rasterizing:
 * walk every element, read computed colors, and rewrite them as rgb()/rgba() inline styles.
 */
function sanitizeModernColors(root: HTMLElement) {
  const COLOR_PROPS = [
    "color",
    "backgroundColor",
    "borderTopColor",
    "borderRightColor",
    "borderBottomColor",
    "borderLeftColor",
    "outlineColor",
    "textDecorationColor",
    "fill",
    "stroke",
  ] as const;

  const all = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
  for (const el of all) {
    const cs = getComputedStyle(el);
    for (const prop of COLOR_PROPS) {
      const val = cs[prop as any] as string;
      if (val && /oklch|oklab|color\(/i.test(val)) {
        // computed value is sometimes already rgb(); only override when needed
        (el.style as any)[prop] = val;
      } else if (val) {
        // Force inline rgb() to be safe — getComputedStyle returns rgb() for resolved colors
        (el.style as any)[prop] = val;
      }
    }
    // Also handle background shorthand (gradients can contain oklch)
    const bg = cs.backgroundImage;
    if (bg && /oklch|oklab|color\(/i.test(bg)) {
      el.style.backgroundImage = "none";
    }
    const bs = cs.boxShadow;
    if (bs && /oklch|oklab|color\(/i.test(bs)) {
      el.style.boxShadow = "none";
    }
  }
}

export async function exportElementToPdf(element: HTMLElement, fileName: string) {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    onclone: (_doc, clonedEl) => {
      try {
        sanitizeModernColors(clonedEl as HTMLElement);
      } catch {
        /* noop */
      }
    },
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
      const ctx = slice.getContext("2d")!;
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

  pdf.save(fileName);
}
