import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export async function exportElementToPdf(element: HTMLElement, fileName: string) {
  // Render at higher scale for crispness
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
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
    // Slice the canvas across multiple pages
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
