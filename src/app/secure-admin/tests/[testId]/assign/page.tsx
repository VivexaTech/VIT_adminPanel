"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PageTransition from "@/components/admin/PageTransition";
import { useToast } from "@/context/ToastContext";
import { getTest } from "@/lib/testService";
import { assignTestToStudents, subscribeToTestAttempts } from "@/lib/testAssignmentService";
import type { InstituteTest, TestAttemptRecord } from "@/types/test";
import type { TestAssignType } from "@/types/test";
import { btnPrimaryBlock, btnSecondaryBlock, inputClass, labelClass, pageHeader, selectClass } from "@/lib/theme";
import { ArrowLeft } from "lucide-react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function AssignTestPage() {
  const params = useParams();
  const testId = String(params.testId || "");
  const router = useRouter();
  const { showToast } = useToast();
  const [test, setTest] = useState<InstituteTest | null>(null);
  const [assignType, setAssignType] = useState<TestAssignType>("student");
  const [studentId, setStudentId] = useState("");
  const [studentIds, setStudentIds] = useState("");
  const [batchId, setBatchId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [attempts, setAttempts] = useState<TestAttemptRecord[]>([]);
  const [batches, setBatches] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!testId) return;
    getTest(testId).then(setTest);
    const unsub = subscribeToTestAttempts(testId, setAttempts);
    const unsubBatches = onSnapshot(collection(db, "batches"), (snap) => {
      setBatches(snap.docs.map((d) => ({ id: d.id, name: d.data().name || d.id })));
    });
    return () => {
      unsub();
      unsubBatches();
    };
  }, [testId]);

  const handleAssign = async () => {
    setAssigning(true);
    try {
      const input = {
        testId,
        assignType,
        dueDate,
        studentIds:
          assignType === "student"
            ? [studentId.trim()]
            : assignType === "students"
            ? studentIds.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean)
            : undefined,
        batchIds: assignType === "batch" ? [batchId.trim()] : undefined,
        courseIds: assignType === "course" ? [courseId.trim()] : undefined,
      };
      const result = await assignTestToStudents(input);
      showToast("success", `Assigned to ${result.assignedCount} student(s).`);
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Assignment failed.");
    } finally {
      setAssigning(false);
    }
  };

  const attempted = attempts.filter((a) => a.status === "attempted");
  const pending = attempts.filter((a) => a.status !== "attempted");

  return (
    <PageTransition>
      <div className={pageHeader}>
        <div>
          <button type="button" onClick={() => router.back()} className="flex items-center gap-1 text-slate-500 text-sm mb-2 hover:text-[#6C3CE9]">
            <ArrowLeft size={16} /> Back
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Assign Test</h1>
          <p className="text-slate-500 text-sm mt-1">{test?.title || testId}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl p-4 sm:p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Assignment</h2>
          <div>
            <label className={labelClass}>Assign To</label>
            <select className={selectClass} value={assignType} onChange={(e) => setAssignType(e.target.value as TestAssignType)}>
              <option value="student">Single Student</option>
              <option value="students">Multiple Students</option>
              <option value="batch">Entire Batch</option>
              <option value="course">Entire Course</option>
            </select>
          </div>
          {assignType === "student" && (
            <div>
              <label className={labelClass}>Student ID</label>
              <input className={inputClass} value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="ST001" />
            </div>
          )}
          {assignType === "students" && (
            <div>
              <label className={labelClass}>Student IDs (comma or newline)</label>
              <textarea className={inputClass + " min-h-[100px]"} value={studentIds} onChange={(e) => setStudentIds(e.target.value)} />
            </div>
          )}
          {assignType === "batch" && (
            <div>
              <label className={labelClass}>Batch</label>
              <select className={selectClass} value={batchId} onChange={(e) => setBatchId(e.target.value)}>
                <option value="">Select batch</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}
          {assignType === "course" && (
            <div>
              <label className={labelClass}>Course ID</label>
              <input className={inputClass} value={courseId} onChange={(e) => setCourseId(e.target.value)} placeholder="VXC-001" />
            </div>
          )}
          <div>
            <label className={labelClass}>Due Date</label>
            <input type="date" className={inputClass} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <button type="button" onClick={handleAssign} disabled={assigning} className={btnPrimaryBlock}>
            {assigning ? "Assigning..." : "Assign Test"}
          </button>
        </div>

        <div className="glass-card rounded-2xl p-4 sm:p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Tracking</h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-slate-900">{attempts.length}</p>
              <p className="text-xs text-slate-500">Assigned</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-emerald-700">{attempted.length}</p>
              <p className="text-xs text-emerald-600">Attempted</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-amber-700">{pending.length}</p>
              <p className="text-xs text-amber-600">Pending</p>
            </div>
          </div>
          <div className="admin-table-scroll max-h-[400px]">
            <table className="w-full text-left min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-2 text-slate-500">Student</th>
                  <th className="py-2 text-slate-500">Score</th>
                  <th className="py-2 text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {attempts.length === 0 ? (
                  <tr><td colSpan={3} className="py-8 text-center text-slate-400">No assignments yet.</td></tr>
                ) : (
                  attempts.map((a) => (
                    <tr key={a.id} className="border-b border-slate-50">
                      <td className="py-2 font-mono text-[#6C3CE9]">{a.studentId}</td>
                      <td className="py-2">{a.status === "attempted" ? `${a.score}/${a.maxScore}` : "—"}</td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${a.passed ? "bg-emerald-100 text-emerald-700" : a.status === "attempted" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                          {a.status === "attempted" ? (a.passed ? "Pass" : "Fail") : "Pending"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
