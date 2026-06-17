"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PageTransition from "@/components/admin/PageTransition";
import { useToast } from "@/context/ToastContext";
import { getTest, saveTest } from "@/lib/testService";
import type { InstituteTest, TestQuestion } from "@/types/test";
import { btnPrimary, btnPrimaryBlock, btnSecondary, btnSecondaryBlock, formGrid, inputClass, labelClass, pageHeader, textareaClass } from "@/lib/theme";
import { ArrowLeft, Plus, Trash2, GripVertical, Users, Upload, Download } from "lucide-react";
import Link from "next/link";
import TestCsvImportModal from "@/components/admin/tests/TestCsvImportModal";
import { downloadCsv, testQuestionsToCsv } from "@/lib/testCsv";

const emptyQuestion = (): TestQuestion => ({
  id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  question: "",
  options: ["", "", "", ""],
  correctAnswer: "",
  marks: 1,
});

export default function TestBuilderPage() {
  const params = useParams();
  const testId = String(params.testId || "");
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [form, setForm] = useState<Partial<InstituteTest>>({ testId, questions: [] });

  useEffect(() => {
    if (!testId) return;
    getTest(testId).then((t) => {
      if (t) setForm(t);
      else setForm({ testId, title: "", questions: [], duration: 30, totalMarks: 10, passingMarks: 5 });
      setLoading(false);
    });
  }, [testId]);

  const questions = form.questions || [];

  const updateQuestion = (index: number, patch: Partial<TestQuestion>) => {
    const next = [...questions];
    next[index] = { ...next[index], ...patch };
    setForm({ ...form, questions: next });
  };

  const removeQuestion = (index: number) => {
    setForm({ ...form, questions: questions.filter((_, i) => i !== index) });
  };

  const moveQuestion = (index: number, dir: -1 | 1) => {
    const next = [...questions];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setForm({ ...form, questions: next });
  };

  const handleSave = async () => {
    if (!form.title?.trim()) {
      showToast("error", "Test title is required.");
      return;
    }
    if (!questions.length) {
      showToast("error", "Add at least one question.");
      return;
    }
    for (const q of questions) {
      if (!q.question.trim() || q.options.some((o) => !o.trim()) || !q.correctAnswer.trim()) {
        showToast("error", "Complete all question fields and correct answers.");
        return;
      }
    }
    setSaving(true);
    try {
      const totalMarks = questions.reduce((s, q) => s + (q.marks ?? 1), 0);
      await saveTest({
        ...form,
        testId,
        totalMarks,
        passingMarks: form.passingMarks ?? Math.ceil(totalMarks * 0.5),
        questions,
      });
      showToast("success", "Test saved.");
      router.push("/secure-admin/tests");
    } catch {
      showToast("error", "Failed to save test.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-[#6C3CE9] border-t-transparent rounded-full animate-spin" />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className={pageHeader}>
        <div>
          <button type="button" onClick={() => router.back()} className="flex items-center gap-1 text-slate-500 text-sm mb-2 hover:text-[#6C3CE9]">
            <ArrowLeft size={16} /> Back
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Test Builder</h1>
          <p className="text-slate-500 text-sm mt-1 font-mono">{testId}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setShowCsvImport(true)}
            className={btnSecondary + " justify-center"}
          >
            <Upload size={18} /> Import CSV
          </button>
          <button
            type="button"
            onClick={() => {
              const payload = { ...form, testId, questions } as InstituteTest;
              downloadCsv(`vivexa-test-${testId}.csv`, testQuestionsToCsv(payload));
              showToast("success", "Test exported to CSV.");
            }}
            className={btnSecondary + " justify-center"}
          >
            <Download size={18} /> Export CSV
          </button>
          <Link href={`/secure-admin/tests/${testId}/assign`} className={btnSecondary + " justify-center"}>
            <Users size={18} /> Assign
          </Link>
          <button type="button" onClick={handleSave} disabled={saving} className={btnPrimaryBlock}>
            {saving ? "Saving..." : "Save Test"}
          </button>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-4 sm:p-6 mb-6 space-y-4">
        <h2 className="font-semibold text-slate-900">Basic Details</h2>
        <div className={formGrid}>
          <div className="sm:col-span-2">
            <label className={labelClass}>Test Title *</label>
            <input className={inputClass} value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Description</label>
            <textarea className={textareaClass} rows={2} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>Course ID</label>
            <input className={inputClass} value={form.courseId || ""} onChange={(e) => setForm({ ...form, courseId: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>Batch ID</label>
            <input className={inputClass} value={form.batchId || ""} onChange={(e) => setForm({ ...form, batchId: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>Duration (min)</label>
            <input type="number" className={inputClass} value={form.duration ?? 30} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })} />
          </div>
          <div>
            <label className={labelClass}>Passing Marks</label>
            <input type="number" className={inputClass} value={form.passingMarks ?? ""} onChange={(e) => setForm({ ...form, passingMarks: Number(e.target.value) })} placeholder="Auto 50%" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-900">Questions ({questions.length})</h2>
        <button type="button" onClick={() => setForm({ ...form, questions: [...questions, emptyQuestion()] })} className={btnPrimary}>
          <Plus size={18} /> Add Question
        </button>
      </div>

      <div className="space-y-4">
        {questions.map((q, index) => (
          <div key={q.id} className="glass-card rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                <GripVertical size={16} />
                Q{index + 1}
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={() => moveQuestion(index, -1)} className="px-2 py-1 text-xs rounded-lg border border-slate-200">↑</button>
                <button type="button" onClick={() => moveQuestion(index, 1)} className="px-2 py-1 text-xs rounded-lg border border-slate-200">↓</button>
                <button type="button" onClick={() => removeQuestion(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div>
              <label className={labelClass}>Question Text</label>
              <textarea className={textareaClass} rows={2} value={q.question} onChange={(e) => updateQuestion(index, { question: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(["A", "B", "C", "D"] as const).map((label, optIdx) => (
                <div key={label}>
                  <label className={labelClass}>Option {label}</label>
                  <input
                    className={inputClass}
                    value={q.options[optIdx] || ""}
                    onChange={(e) => {
                      const options = [...q.options];
                      while (options.length < 4) options.push("");
                      options[optIdx] = e.target.value;
                      updateQuestion(index, { options });
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Correct Answer (exact option text)</label>
                <input className={inputClass} value={q.correctAnswer} onChange={(e) => updateQuestion(index, { correctAnswer: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>Marks</label>
                <input type="number" min={1} className={inputClass} value={q.marks ?? 1} onChange={(e) => updateQuestion(index, { marks: Number(e.target.value) })} />
              </div>
            </div>
          </div>
        ))}
        {!questions.length && (
          <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-2xl">
            No questions yet. Click &quot;Add Question&quot; to start building.
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end">
        <button type="button" onClick={handleSave} disabled={saving} className={btnPrimaryBlock}>
          {saving ? "Saving..." : "Save Test"}
        </button>
      </div>

      <TestCsvImportModal
        open={showCsvImport}
        onClose={() => setShowCsvImport(false)}
        testId={testId}
        onComplete={() => {
          showToast("success", "Questions imported. Reloading…");
          getTest(testId).then((t) => {
            if (t) setForm(t);
          });
        }}
      />
    </PageTransition>
  );
}
