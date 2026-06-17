"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, Download, CheckCircle2, AlertCircle } from "lucide-react";
import AdminModal from "@/components/ui/AdminModal";
import {
  getSampleQuestionsCsv,
  parseTestQuestionsCsv,
  type CsvImportResult,
  type CsvRowError,
} from "@/lib/testCsv";
import { importQuestionsFromCsv } from "@/lib/testService";
import { TEST_QUESTION_CSV_HEADERS } from "@/types/test";
import { btnPrimaryBlock, btnSecondaryBlock } from "@/lib/theme";

type Props = {
  open: boolean;
  onClose: () => void;
  onComplete: (result: CsvImportResult) => void;
  testId?: string;
};

export default function TestCsvImportModal({ open, onClose, onComplete, testId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [parseErrors, setParseErrors] = useState<CsvRowError[]>([]);
  const [fileName, setFileName] = useState("");
  const [report, setReport] = useState<CsvImportResult | null>(null);

  const reset = () => {
    setParseErrors([]);
    setReport(null);
    setFileName("");
    setProgress(0);
  };

  const handleClose = () => {
    if (importing) return;
    reset();
    onClose();
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setParseErrors([]);
    setReport(null);

    const text = await file.text();
    const { rows, errors } = parseTestQuestionsCsv(text);

    const filteredRows = testId
      ? rows.filter((r) => r.values.testId.trim() === testId)
      : rows;

    if (errors.length && !filteredRows.length) {
      setParseErrors(errors);
      return;
    }

    setImporting(true);
    setProgress(0);

    try {
      const result = await importQuestionsFromCsv(
        filteredRows.map((r) => r.values),
        (done, total) => setProgress(Math.round((done / total) * 100))
      );

      result.errors = [...errors, ...result.errors];
      result.skipped += errors.length;
      setReport(result);
      onComplete(result);
    } catch (err) {
      setParseErrors([{ row: 0, message: err instanceof Error ? err.message : "Import failed" }]);
    } finally {
      setImporting(false);
    }
  };

  return (
    <AdminModal
      open={open}
      onClose={handleClose}
      title="Import Test Questions (CSV)"
      size="md"
      closeOnBackdrop={!importing}
      footer={
        <button type="button" onClick={handleClose} disabled={importing} className={btnPrimaryBlock}>
          {report ? "Done" : "Close"}
        </button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Upload one row per question. Existing <strong>Question IDs</strong> are updated (no duplicates).
          {testId ? (
            <> Only rows with Test ID <span className="font-mono text-[#6C3CE9]">{testId}</span> will be imported.</>
          ) : (
            <> If the Test ID exists, questions are added or updated inside that test.</>
          )}
        </p>

        <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 font-mono overflow-x-auto">
          {TEST_QUESTION_CSV_HEADERS.join(", ")}
        </div>

        <button
          type="button"
          onClick={() => {
            const blob = new Blob([getSampleQuestionsCsv()], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "test-questions-template.csv";
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="text-sm text-[#6C3CE9] flex items-center gap-1 hover:underline"
        >
          <Download size={16} /> Download sample template
        </button>

        {!report && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />

            <button
              type="button"
              disabled={importing}
              onClick={() => inputRef.current?.click()}
              className="w-full border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-[#6C3CE9]/40 hover:bg-violet-50/50 transition-colors flex items-center justify-center gap-2"
            >
              {importing ? (
                <Loader2 size={18} className="animate-spin text-[#6C3CE9]" />
              ) : (
                <Upload size={18} />
              )}
              <span className="text-sm font-medium text-slate-700 truncate">
                {fileName || "Choose CSV file"}
              </span>
            </button>

            {importing && (
              <div className="space-y-1">
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#6C3CE9] transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-xs text-slate-400 text-center">Importing… {progress}%</p>
              </div>
            )}
          </>
        )}

        {report && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl p-3">
              <CheckCircle2 size={20} />
              <span className="font-medium text-sm">Import complete</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
              <Stat label="Questions added" value={report.inserted} />
              <Stat label="Questions updated" value={report.updated} />
              <Stat label="Tests created" value={report.testsCreated} />
              <Stat label="Tests updated" value={report.testsUpdated} />
              <Stat label="Question bank" value={report.bankUpserted} />
              <Stat label="Skipped rows" value={report.skipped} variant="warn" />
            </div>
            {report.errors.length > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 max-h-40 overflow-y-auto">
                <div className="flex items-center gap-1 text-amber-800 text-xs font-medium mb-2">
                  <AlertCircle size={14} /> Invalid rows skipped ({report.errors.length})
                </div>
                {report.errors.slice(0, 20).map((e, i) => (
                  <p key={i} className="text-xs text-amber-700 break-words">
                    Row {e.row}
                    {e.testId ? ` · ${e.testId}` : ""}
                    {e.questionId ? ` · ${e.questionId}` : ""}: {e.message}
                  </p>
                ))}
                {report.errors.length > 20 && (
                  <p className="text-xs text-amber-600 mt-1">…and {report.errors.length - 20} more</p>
                )}
              </div>
            )}
            <button type="button" onClick={reset} className={btnSecondaryBlock}>
              Import another file
            </button>
          </div>
        )}

        {parseErrors.length > 0 && !report && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 max-h-32 overflow-y-auto">
            {parseErrors.map((e, i) => (
              <p key={i} className="text-xs text-red-600 break-words">
                Row {e.row}: {e.message}
              </p>
            ))}
          </div>
        )}
      </div>
    </AdminModal>
  );
}

function Stat({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant?: "warn";
}) {
  return (
    <div
      className={`rounded-xl p-3 border ${
        variant === "warn" && value > 0
          ? "bg-amber-50 border-amber-100"
          : "bg-white border-slate-100"
      }`}
    >
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}
