"use client";

import { useState } from "react";
import { Download, Printer, X } from "lucide-react";
import { btnPrimaryBlock, btnSecondaryBlock } from "@/lib/theme";
import { downloadReceiptHtml, downloadReceiptPdf, printReceiptHtml } from "@/lib/receiptPdf";

type Props = {
  open: boolean;
  title?: string;
  receiptNo: string;
  studentId: string;
  receiptHtml: string;
  onClose: () => void;
};

/**
 * In-app receipt preview with Print + Download PDF.
 */
export default function ReceiptPreviewModal({
  open,
  title = "Fee Invoice / Receipt",
  receiptNo,
  studentId,
  receiptHtml,
  onClose,
}: Props) {
  const [busy, setBusy] = useState<"pdf" | "print" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open || !receiptHtml) return null;

  const handlePrint = async () => {
    setError(null);
    setBusy("print");
    try {
      printReceiptHtml(receiptHtml);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to print receipt.");
    } finally {
      setBusy(null);
    }
  };

  const handleDownloadPdf = async () => {
    setError(null);
    setBusy("pdf");
    try {
      await downloadReceiptPdf(receiptHtml, receiptNo);
    } catch (err) {
      console.error(err);
      // Fallback: download HTML so user still gets the invoice
      try {
        downloadReceiptHtml(receiptHtml, receiptNo);
        setError("PDF capture failed — HTML invoice downloaded instead. Open it and Print → Save as PDF.");
      } catch {
        setError(err instanceof Error ? err.message : "Failed to download invoice.");
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/55 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-4xl max-h-[94dvh] rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-4 sm:px-5 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {receiptNo} · Student {studentId}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 min-h-0 bg-slate-100 p-2 sm:p-3">
          <iframe
            id="vit-receipt-frame"
            title="Fee Receipt Preview"
            srcDoc={receiptHtml}
            className="w-full h-[58vh] sm:h-[62vh] rounded-xl bg-white border border-slate-200"
          />
        </div>

        {error ? (
          <p className="px-4 sm:px-5 pt-3 text-sm text-amber-700 bg-amber-50 border-t border-amber-100">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-4 sm:px-5 py-4 border-t border-slate-100 shrink-0">
          <button type="button" onClick={onClose} className="text-sm text-slate-500 py-2.5 px-4 hover:text-slate-800">
            Done
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={!!busy}
            className={btnSecondaryBlock}
          >
            <Download size={16} />
            {busy === "pdf" ? "Preparing PDF..." : "Download PDF"}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={!!busy}
            className={btnPrimaryBlock}
          >
            <Printer size={16} />
            {busy === "print" ? "Opening..." : "Print Receipt"}
          </button>
        </div>
      </div>
    </div>
  );
}
