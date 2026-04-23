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

function inlineResolvedStyles(sourceRoot: HTMLElement, cloneRoot: HTMLElement) {
  const sourceNodes = [sourceRoot, ...Array.from(sourceRoot.querySelectorAll<HTMLElement>("*"))];
  const cloneNodes = [cloneRoot, ...Array.from(cloneRoot.querySelectorAll<HTMLElement>("*"))];

  sourceNodes.forEach((sourceNode, index) => {
    const cloneNode = cloneNodes[index];
    if (!cloneNode) return;

    const computed = getComputedStyle(sourceNode);
    for (let i = 0; i < computed.length; i += 1) {
      const prop = computed.item(i);
      if (!prop) continue;
      const value = computed.getPropertyValue(prop);
      const priority = computed.getPropertyPriority(prop);
      if (!value) continue;

      try {
        cloneNode.style.setProperty(prop, value, priority);
      } catch {
        /* noop */
      }
    }

    cloneNode.removeAttribute("class");

    if (cloneNode instanceof HTMLInputElement || cloneNode instanceof HTMLTextAreaElement || cloneNode instanceof HTMLSelectElement) {
      cloneNode.value = sourceNode instanceof HTMLInputElement || sourceNode instanceof HTMLTextAreaElement || sourceNode instanceof HTMLSelectElement
        ? sourceNode.value
        : cloneNode.value;
    }
  });
}

function createSanitizedRenderTarget(element: HTMLElement) {
  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.left = "-10000px";
  wrapper.style.top = "0";
  wrapper.style.zIndex = "-1";
  wrapper.style.pointerEvents = "none";
  wrapper.style.background = "#ffffff";

  const clone = element.cloneNode(true) as HTMLElement;
  const rect = element.getBoundingClientRect();
  clone.style.width = `${Math.ceil(rect.width)}px`;
  clone.style.maxWidth = `${Math.ceil(rect.width)}px`;
  clone.style.minWidth = `${Math.ceil(rect.width)}px`;

  inlineResolvedStyles(element, clone);
  sanitizeModernColors(clone);

  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  return {
    target: clone,
    cleanup: () => wrapper.remove(),
  };
}

function stripProblematicStyles(doc: Document) {
  const stylesheetNodes = Array.from(doc.querySelectorAll('style, link[rel="stylesheet"]'));

  stylesheetNodes.forEach((node) => {
    if (node instanceof HTMLLinkElement) {
      const href = node.href || "";
      if (/fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(href)) return;
    }

    node.remove();
  });
}

export async function exportElementToPdf(element: HTMLElement, fileName: string) {
  const { target, cleanup } = createSanitizedRenderTarget(element);

  try {
    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      onclone: (doc, clonedEl) => {
        try {
          stripProblematicStyles(doc);
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
  } finally {
    cleanup();
  }
}
