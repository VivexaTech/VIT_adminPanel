"use client";

import { useEffect, useState } from "react";
import PageTransition from "@/components/admin/PageTransition";
import TestCsvImportModal from "@/components/admin/tests/TestCsvImportModal";
import TestCsvExportModal from "@/components/admin/tests/TestCsvExportModal";
import { Plus, Trash2, ClipboardList, Download, Upload, Edit2, Users, BookOpen } from "lucide-react";
import Link from "next/link";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/context/ToastContext";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { btnPrimary, btnPrimaryBlock, btnSecondary, btnSecondaryBlock, inputClass, labelClass, modalFooter } from "@/lib/theme";
import type { InstituteTest } from "@/types/test";
import type { CsvImportResult } from "@/lib/testCsv";

export default function TestsPage() {
  const { showToast } = useToast();
  const [tests, setTests] = useState<InstituteTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [showCsvExport, setShowCsvExport] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [testId, setTestId] = useState("");
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState("");
  const [subject, setSubject] = useState("");
  const [duration, setDuration] = useState("30");
  const [totalMarks, setTotalMarks] = useState("10");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return onSnapshot(collection(db, "institute_tests"), (snap) => {
      setTests(
        snap.docs.map(
          (d) =>
            ({
              id: d.id,
              testId: d.data().testId || d.id,
              ...d.data(),
            }) as InstituteTest
        )
      );
      setLoading(false);
    });
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === tests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tests.map((t) => t.testId || t.id)));
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !testId.trim()) return;
    setSaving(true);
    try {
      const newTestDocId = testId.trim();
      await setDoc(
        doc(db, "institute_tests", newTestDocId),
        {
          testId: newTestDocId,
          title: title.trim(),
          courseId: courseId.trim() || null,
          course: courseId.trim() || null,
          subject: subject.trim() || null,
          type: "weekly",
          duration: Number(duration) || 30,
          totalMarks: Number(totalMarks) || 10,
          status: "active",
          questions: [],
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
      showToast("success", "Test created. Add questions in the builder.");
      setShowForm(false);
      setTestId("");
      setTitle("");
      setCourseId("");
      setSubject("");
      window.location.href = `/secure-admin/tests/${newTestDocId}`;
    } catch {
      showToast("error", "Failed to save test.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteDoc(doc(db, "institute_tests", deleteId));
    showToast("success", "Test deleted.");
    setDeleteId(null);
  };

  const handleImportComplete = (result: CsvImportResult) => {
    const hasErrors = result.errors.length > 0;
    const msg = `${result.inserted} added, ${result.updated} updated, ${result.bankUpserted} in bank`;
    showToast(hasErrors ? "error" : "success", `Import: ${msg}`);
  };

  return (
    <PageTransition>
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="text-[#6C3CE9]" size={26} /> Tests
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Build tests, import/export questions via CSV, and manage the question bank.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/secure-admin/tests/question-bank" className={btnSecondary}>
            <BookOpen size={18} /> Question Bank
          </Link>
          <button type="button" onClick={() => setShowCsvExport(true)} className={btnSecondary}>
            <Download size={18} /> Export CSV
          </button>
          <button type="button" onClick={() => setShowCsvImport(true)} className={btnSecondary}>
            <Upload size={18} /> Import CSV
          </button>
          <button type="button" onClick={() => setShowForm(true)} className={btnPrimary}>
            <Plus size={18} /> Add Test
          </button>
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-left min-w-[760px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={tests.length > 0 && selectedIds.size === tests.length}
                  onChange={toggleSelectAll}
                  className="accent-[#6C3CE9]"
                  aria-label="Select all tests"
                />
              </th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Test ID</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Title</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Course</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Subject</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Marks</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Duration</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Questions</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-5 py-12 text-center text-slate-400">
                  Loading...
                </td>
              </tr>
            ) : tests.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-12 text-center text-slate-400">
                  No tests yet. Import a CSV or add manually.
                </td>
              </tr>
            ) : (
              tests.map((t) => {
                const id = t.testId || t.id;
                return (
                  <tr key={t.id} className="border-b border-slate-50">
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(id)}
                        onChange={() => toggleSelect(id)}
                        className="accent-[#6C3CE9]"
                        aria-label={`Select ${id}`}
                      />
                    </td>
                    <td className="px-5 py-4 font-mono text-sm text-[#6C3CE9]">{id}</td>
                    <td className="px-5 py-4 font-medium text-slate-900">{t.title}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{t.courseId || t.course || "—"}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{t.subject || "—"}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{t.totalMarks ?? t.questions?.length ?? "—"}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{t.duration} min</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{t.questions?.length ?? 0}</td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/secure-admin/tests/${id}`} className="p-2 text-slate-400 hover:text-[#6C3CE9] rounded-lg" title="Edit / Builder">
                          <Edit2 size={16} />
                        </Link>
                        <Link href={`/secure-admin/tests/${id}/assign`} className="p-2 text-slate-400 hover:text-blue-600 rounded-lg" title="Assign">
                          <Users size={16} />
                        </Link>
                        <button type="button" onClick={() => setDeleteId(t.id)} className="p-2 text-slate-400 hover:text-red-500 rounded-lg">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <form onSubmit={handleAdd} className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[92dvh] overflow-y-auto p-4 sm:p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="font-semibold text-slate-900">New Test</h3>
            <div>
              <label className={labelClass}>Test ID *</label>
              <input className={inputClass} value={testId} onChange={(e) => setTestId(e.target.value)} required placeholder="VT-001" />
            </div>
            <div>
              <label className={labelClass}>Test Name *</label>
              <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div>
              <label className={labelClass}>Course ID</label>
              <input className={inputClass} value={courseId} onChange={(e) => setCourseId(e.target.value)} placeholder="VXC-001" />
            </div>
            <div>
              <label className={labelClass}>Subject</label>
              <input className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Total Marks</label>
                <input type="number" className={inputClass} value={totalMarks} onChange={(e) => setTotalMarks(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Duration (min)</label>
                <input type="number" className={inputClass} value={duration} onChange={(e) => setDuration(e.target.value)} />
              </div>
            </div>
            <div className={modalFooter + " !px-0 !py-0 !border-0 pt-2"}>
              <button type="button" onClick={() => setShowForm(false)} className={btnSecondaryBlock}>Cancel</button>
              <button type="submit" disabled={saving} className={btnPrimaryBlock}>Save</button>
            </div>
          </form>
        </div>
      )}

      <TestCsvImportModal
        open={showCsvImport}
        onClose={() => setShowCsvImport(false)}
        onComplete={handleImportComplete}
      />

      <TestCsvExportModal
        open={showCsvExport}
        onClose={() => setShowCsvExport(false)}
        tests={tests}
        selectedTestIds={Array.from(selectedIds)}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Test"
        message="Remove this test template?"
        destructive
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </PageTransition>
  );
}
