import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

/**
 * Render receipt HTML into an off-screen iframe, capture as PDF, and download.
 */
export async function downloadReceiptPdf(receiptHtml: string, receiptNo: string): Promise<void> {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = "820px";
  iframe.style.height = "1160px";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) throw new Error("Unable to create receipt frame.");

    doc.open();
    doc.write(receiptHtml);
    doc.close();

    // Wait for images (logo/signature) to settle
    await new Promise<void>((resolve) => {
      const imgs = Array.from(doc.images || []);
      if (imgs.length === 0) {
        resolve();
        return;
      }
      let remaining = imgs.length;
      const done = () => {
        remaining -= 1;
        if (remaining <= 0) resolve();
      };
      imgs.forEach((img) => {
        if (img.complete) done();
        else {
          img.onload = done;
          img.onerror = done;
        }
      });
      setTimeout(resolve, 2500);
    });

    await new Promise((r) => setTimeout(r, 120));

    const target =
      (doc.getElementById("vit-receipt-sheet") as HTMLElement | null) ||
      (doc.body as HTMLElement);

    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: 820,
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const usableWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * usableWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = margin;

    pdf.addImage(imgData, "JPEG", margin, position, usableWidth, imgHeight);
    heightLeft -= pageHeight - margin * 2;

    while (heightLeft > 0) {
      position = margin - (imgHeight - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", margin, position, usableWidth, imgHeight);
      heightLeft -= pageHeight - margin * 2;
    }

    const safeName = String(receiptNo || "receipt").replace(/[^\w.-]+/g, "_");
    pdf.save(`${safeName}.pdf`);
  } finally {
    document.body.removeChild(iframe);
  }
}

export function downloadReceiptHtml(receiptHtml: string, receiptNo: string): void {
  const blob = new Blob([receiptHtml], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${String(receiptNo || "receipt").replace(/[^\w.-]+/g, "_")}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function printReceiptHtml(receiptHtml: string): void {
  const iframe = document.getElementById("vit-receipt-frame") as HTMLIFrameElement | null;
  const existing = iframe?.contentWindow;
  if (existing) {
    existing.focus();
    existing.print();
    return;
  }

  const blob = new Blob([receiptHtml], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank", "width=900,height=700");
  if (!w) {
    URL.revokeObjectURL(url);
    throw new Error("Popup blocked. Please allow pop-ups to print.");
  }
  w.onload = () => {
    try {
      w.focus();
      w.print();
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
  };
}
