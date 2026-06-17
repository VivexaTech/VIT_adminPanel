"use client";

import { useEffect, useState } from "react";
import PageTransition from "@/components/admin/PageTransition";
import { BookOpen, Download, Search, Trash2 } from "lucide-react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { downloadCsv, questionBankToCsv } from "@/lib/testCsv";
import { deleteQuestionBankEntry } from "@/lib/questionBankService";
import { useToast } from "@/context/ToastContext";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { btnSecondary } from "@/lib/theme";
import type { QuestionBankEntry } from "@/types/test";
import Link from "next/link";

export default function QuestionBankPage() {
  const { showToast } = useToast();
  const [entries, setEntries] = useState<QuestionBankEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    return onSnapshot(collection(db, "question_bank"), (snap) => {
      setEntries(
        snap.docs.map(
          (d) =>
            ({
              id: d.id,
              questionId: d.data().questionId || d.id,
              ...d.data(),
            }) as QuestionBankEntry
        )
      );
      setLoading(false);
    });
  }, []);

  const filtered = entries.filter((e) => {
    const q = search.toLowerCase();
    return (
      e.questionId.toLowerCase().includes(q) ||
      e.question.toLowerCase().includes(q) ||
      (e.subject || "").toLowerCase().includes(q) ||
      (e.usedInTests || []).some((t) => t.toLowerCase().includes(q))
    );
  });

  const handleExport = () => {
    if (!entries.length) {
      showToast("error", "Question bank is empty.");
      return;
    }
    downloadCsv(
      `vivexa-question-bank-${new Date().toISOString().slice(0, 10)}.csv`,
      questionBankToCsv(entries)
    );
    showToast("success", "Question bank exported.");
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteQuestionBankEntry(deleteId);
    showToast("success", "Question removed from bank.");
    setDeleteId(null);
  };

  return (
    <PageTransition>
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
        <div>
          <Link href="/secure-admin/tests" className="text-sm text-[#6C3CE9] hover:underline">
            ← Back to Tests
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2 mt-2">
            <BookOpen className="text-[#6C3CE9]" size={26} /> Question Bank
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Centralized questions imported via CSV — reusable across multiple tests.
          </p>
        </div>
        <button type="button" onClick={handleExport} className={btnSecondary}>
          <Download size={18} /> Export Bank CSV
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm"
          placeholder="Search by ID, question, subject, or test…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-left min-w-[800px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Question ID</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Question</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Marks</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Used In</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                  {entries.length === 0
                    ? "No questions yet. Import a CSV from Tests to populate the bank."
                    : "No matches for your search."}
                </td>
              </tr>
            ) : (
              filtered.map((e) => (
                <tr key={e.id} className="border-b border-slate-50">
                  <td className="px-5 py-4 font-mono text-sm text-[#6C3CE9]">{e.questionId}</td>
                  <td className="px-5 py-4 text-sm text-slate-800 max-w-md truncate">{e.question}</td>
                  <td className="px-5 py-4 text-sm text-slate-600">{e.marks}</td>
                  <td className="px-5 py-4 text-sm text-slate-600">
                    {(e.usedInTests || []).length ? (e.usedInTests || []).join(", ") : "—"}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => setDeleteId(e.id)}
                      className="p-2 text-slate-400 hover:text-red-500 rounded-lg"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Remove from Question Bank"
        message="This removes the question from the bank but does not delete it from existing tests."
        destructive
        confirmLabel="Remove"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </PageTransition>
  );
}
