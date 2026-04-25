import { toast } from "sonner";

/**
 * Opens a new window with the element's HTML and triggers print.
 * Better than window.print() for isolated reports — doesn't print the whole app shell.
 */
export function printElement(element: HTMLElement, title: string) {
  const printWindow = window.open("", "_blank", "width=1100,height=900");
  if (!printWindow) {
    toast.error("تعذر فتح نافذة الطباعة. تأكد من السماح بالنوافذ المنبثقة.");
    return;
  }

  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((node) => node.outerHTML)
    .join("\n");

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    ${styles}
    <style>
      @page { size: A4; margin: 10mm; }
      body { margin: 0; padding: 0; background: white; color: black; font-family: 'Cairo','Tajawal',system-ui,sans-serif; }
      .print-shell { padding: 0; }
      /* hide elements explicitly marked */
      .print\\:hidden { display: none !important; }
    </style>
  </head>
  <body>
    <div class="print-shell">${element.outerHTML}</div>
    <script>
      window.onload = () => {
        setTimeout(() => {
          window.focus();
          window.print();
          window.close();
        }, 300);
      };
    </script>
  </body>
</html>`);
  printWindow.document.close();
}

/**
 * Renders a React element off-screen, then prints it via printElement.
 * Uses the same off-screen mount pattern as renderReportToPdf.
 */
export async function printReactElement(
  element: import("react").ReactElement,
  title: string,
) {
  const { createRoot } = await import("react-dom/client");
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.zIndex = "-1";
  host.style.background = "#ffffff";
  document.body.appendChild(host);

  const root = createRoot(host);
  root.render(element);

  await new Promise((r) => setTimeout(r, 100));
  if ((document as { fonts?: { ready?: Promise<void> } }).fonts?.ready) {
    try {
      await (document as { fonts: { ready: Promise<void> } }).fonts.ready;
    } catch {
      /* noop */
    }
  }
  const imgs = Array.from(host.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise((res) => {
            img.onload = res;
            img.onerror = res;
          }),
    ),
  );
  await new Promise((r) => setTimeout(r, 50));

  try {
    const target = host.firstElementChild as HTMLElement;
    if (!target) throw new Error("Report element not rendered");
    printElement(target, title);
  } finally {
    // Give the new window time to read outerHTML before unmount
    setTimeout(() => {
      root.unmount();
      host.remove();
    }, 1000);
  }
}
