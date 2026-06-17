"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import AdminModal from "@/components/ui/AdminModal";
import {
  allTestsQuestionsToCsv,
  downloadCsv,
  questionBankToCsv,
  testQuestionsToCsv,
} from "@/lib/testCsv";
import { getAllQuestionBankEntries } from "@/lib/questionBankService";
import type { InstituteTest } from "@/types/test";
import { btnPrimaryBlock, btnSecondaryBlock, inputClass, labelClass } from "@/lib/theme";

type ExportMode = "complete" | "selected" | "all" | "bank";

type Props = {
  open: boolean;
  onClose: () => void;
  tests: InstituteTest[];
  selectedTestIds: string[];
};

export default function TestCsvExportModal({ open, onClose, tests, selectedTestIds }: Props) {
  const [mode, setMode] = useState<ExportMode>("all");
  const [singleTestId, setSingleTestId] = useState("");
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const date = new Date().toISOString().slice(0, 10);

      if (mode === "bank") {
        const entries = await getAllQuestionBankEntries();
        if (!entries.length) {
          alert("Question bank is empty.");
          return;
        }
        downloadCsv(`vivexa-question-bank-${date}.csv`, questionBankToCsv(entries));
      } else if (mode === "complete") {
        const test = tests.find((t) => (t.testId || t.id) === singleTestId);
        if (!test) {
          alert("Select a test to export.");
          return;
        }
        const id = test.testId || test.id;
        downloadCsv(`vivexa-test-${id}-${date}.csv`, testQuestionsToCsv(test));
      } else if (mode === "selected") {
        const selected = tests.filter((t) => selectedTestIds.includes(t.testId || t.id));
        if (!selected.length) {
          alert("Select at least one test from the list.");
          return;
        }
        downloadCsv(`vivexa-tests-selected-${date}.csv`, allTestsQuestionsToCsv(selected));
      } else {
        if (!tests.length) {
          alert("No tests to export.");
          return;
        }
        downloadCsv(`vivexa-all-questions-${date}.csv`, allTestsQuestionsToCsv(tests));
      }
      onClose();
    } finally {
      setExporting(false);
    }
  };

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title="Export Test Questions (CSV)"
      size="sm"
      closeOnBackdrop={!exporting}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={exporting} className={btnSecondaryBlock}>
            Cancel
          </button>
          <button type="button" onClick={handleExport} disabled={exporting} className={btnPrimaryBlock}>
            {exporting ? (
              <>
                <Loader2 size={16} className="animate-spin inline mr-1" /> Exporting…
              </>
            ) : (
              <>
                <Download size={16} className="inline mr-1" /> Export
              </>
            )}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <ExportOption
          checked={mode === "complete"}
          onChange={() => setMode("complete")}
          title="Complete Test"
          description="Export all questions for one test"
        />
        {mode === "complete" && (
          <select
            className={inputClass}
            value={singleTestId}
            onChange={(e) => setSingleTestId(e.target.value)}
          >
            <option value="">Select test…</option>
            {tests.map((t) => {
              const id = t.testId || t.id;
              return (
                <option key={id} value={id}>
                  {id} — {t.title}
                </option>
              );
            })}
          </select>
        )}

        <ExportOption
          checked={mode === "selected"}
          onChange={() => setMode("selected")}
          title="Selected Tests"
          description={`${selectedTestIds.length} test(s) selected in the list`}
        />

        <ExportOption
          checked={mode === "all"}
          onChange={() => setMode("all")}
          title="All Questions"
          description={`Export every question from all ${tests.length} tests`}
        />

        <ExportOption
          checked={mode === "bank"}
          onChange={() => setMode("bank")}
          title="Question Bank"
          description="Centralized reusable questions from Firebase"
        />

        <p className={labelClass + " !mb-0 pt-2"}>
          CSV columns: testId, testTitle, questionId, question, optionA–D, correctAnswer, marks
        </p>
      </div>
    </AdminModal>
  );
}

function ExportOption({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  description: string;
}) {
  return (
    <label
      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
        checked ? "border-[#6C3CE9] bg-violet-50/50" : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <input type="radio" checked={checked} onChange={onChange} className="mt-1 accent-[#6C3CE9]" />
      <div>
        <p className="font-medium text-sm text-slate-900">{title}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
    </label>
  );
}
