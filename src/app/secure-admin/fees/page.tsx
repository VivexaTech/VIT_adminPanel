"use client";

import { useState, useEffect } from "react";
import PageTransition from "@/components/admin/PageTransition";
import StatCard from "@/components/admin/StatCard";
import { Search, Plus, Edit2, Trash2, X, CheckCircle, Wallet, CreditCard, Banknote, Users, Eye } from "lucide-react";
import { collection, getDocs, deleteDoc, doc, setDoc, query, orderBy, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  btnPrimary,
  btnPrimaryBlock,
  btnSecondaryBlock,
  inputClass,
  labelClass,
  modalFooter,
  modalHeader,
  modalBody,
  pageHeader,
  pageTitle,
  pageSubtitle,
  selectClass,
  statsGrid,
} from "@/lib/theme";
import { syncStudentFeeMirror } from "@/lib/feeSync";
import { createApprovalRequest } from "@/lib/approvalService";
import { isSuperAdmin } from "@/lib/rbac";
import { logAudit } from "@/lib/auditService";

export default function FeeManagementPage() {
  const { user } = useAuth();
  const [feeRecords, setFeeRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  
  // Analytics State
  const [stats, setStats] = useState({
    totalRevenue: 0,
    pendingFees: 0,
    collectedThisMonth: 0,
    studentsPending: 0,
    studentsPaid: 0,
    studentsPartial: 0
  });

  // Modals State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<any>(null);

  // Smart Form State
  const [studentIdInput, setStudentIdInput] = useState("");
  const [fetchingStudent, setFetchingStudent] = useState(false);
  const [fetchedStudent, setFetchedStudent] = useState<any>(null);
  const [fetchError, setFetchError] = useState("");

  const fetchFeeRecords = async () => {
    try {
      const q = query(collection(db, "student_fees"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFeeRecords(data);
      calculateAnalytics(data);
    } catch (error) {
      console.error("Error fetching fee records: ", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeeRecords();
  }, []);

  const calculateAnalytics = (records: any[]) => {
    let revenue = 0;
    let pending = 0;
    let thisMonth = 0;
    let pCount = 0;
    let paidCount = 0;
    let partialCount = 0;

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    records.forEach(record => {
      revenue += (record.paidAmount || 0);
      pending += (record.remainingFee || 0);
      
      if (record.paymentStatus === 'Pending') pCount++;
      else if (record.paymentStatus === 'Paid') paidCount++;
      else if (record.paymentStatus === 'Partial') partialCount++;

      if (record.installments && Array.isArray(record.installments)) {
        record.installments.forEach((inst: any) => {
          const d = new Date(inst.date);
          if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
            thisMonth += (Number(inst.amount) || 0);
          }
        });
      }
    });

    setStats({
      totalRevenue: revenue,
      pendingFees: pending,
      collectedThisMonth: thisMonth,
      studentsPending: pCount,
      studentsPaid: paidCount,
      studentsPartial: partialCount
    });
  };

  const handleFetchStudent = async () => {
    if (!studentIdInput.trim()) return;
    setFetchingStudent(true);
    setFetchError("");
    setFetchedStudent(null);
    
    try {
      const docRef = doc(db, "students", studentIdInput.trim());
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const existingFeeRef = doc(db, "student_fees", studentIdInput.trim());
        const existingFeeSnap = await getDoc(existingFeeRef);
        
        if (existingFeeSnap.exists()) {
          setFetchError("Fee record already exists for this student");
        } else {
          setFetchedStudent({ id: docSnap.id, ...docSnap.data() });
        }
      } else {
        setFetchError("Student not found");
      }
    } catch (error) {
      setFetchError("Error fetching student details");
    } finally {
      setFetchingStudent(false);
    }
  };

  const handleCreateFee = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!fetchedStudent) {
      alert("Please fetch a valid student first.");
      return;
    }

    const formData = new FormData(e.currentTarget);
    const totalFee = Number(formData.get("totalFee"));
    const discount = Number(formData.get("discount") || 0);
    const admissionFee = Number(formData.get("admissionFee") || 0);
    
    const actualTotal = totalFee - discount;
    const paidAmount = admissionFee;
    const remainingFee = actualTotal - paidAmount;
    
    let paymentStatus = "Pending";
    if (paidAmount >= actualTotal) paymentStatus = "Paid";
    else if (paidAmount > 0) paymentStatus = "Partial";

    const installments = [];
    if (admissionFee > 0) {
      installments.push({
        amount: admissionFee,
        method: String(formData.get("paymentMethod") || "Cash"),
        transactionId: String(formData.get("transactionId") || "N/A"),
        date: new Date().toISOString(),
        note: "Admission Fee"
      });
    }

    const data = {
      studentId: fetchedStudent.studentId,
      studentName: fetchedStudent.fullName,
      course: fetchedStudent.course,
      totalFee: actualTotal,
      originalFee: totalFee,
      discount: discount,
      paidAmount: paidAmount,
      remainingFee: remainingFee,
      paymentStatus: paymentStatus,
      installmentType: formData.get("installmentType"),
      dueDate: formData.get("dueDate"),
      notes: formData.get("notes"),
      installments: installments,
      createdAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, "student_fees", fetchedStudent.studentId), data);
      await syncStudentFeeMirror({
        studentId: fetchedStudent.studentId,
        studentName: fetchedStudent.fullName,
        course: fetchedStudent.course,
        totalFee: actualTotal,
        paidAmount,
        remainingFee,
        paymentStatus,
        dueDate: String(formData.get("dueDate") || ""),
        installmentType: String(formData.get("installmentType") || ""),
        installments: installments.map((inst) => ({
          ...inst,
          method: String(inst.method),
          transactionId: String(inst.transactionId),
        })),
      });
      setShowCreateModal(false);
      setStudentIdInput("");
      setFetchedStudent(null);
      fetchFeeRecords();
    } catch (error) {
      console.error("Error creating fee record: ", error);
      alert("Failed to create fee record.");
    }
  };

  const handleAddPayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentRecord) return;

    const formData = new FormData(e.currentTarget);
    const amountPaid = Number(formData.get("amount"));
    
    const newPaidAmount = currentRecord.paidAmount + amountPaid;
    const newRemainingFee = Math.max(0, currentRecord.totalFee - newPaidAmount);
    
    let paymentStatus = currentRecord.paymentStatus;
    if (newRemainingFee === 0) paymentStatus = "Paid";
    else if (newPaidAmount > 0) paymentStatus = "Partial";

    const newInstallment = {
      amount: amountPaid,
      method: String(formData.get("method") || ""),
      transactionId: String(formData.get("transactionId") || "N/A"),
      date: String(formData.get("date") || new Date().toISOString()),
      note: String(formData.get("notes") || ""),
    };

    try {
      const docRef = doc(db, "student_fees", currentRecord.id);
      const updatedInstallments = [...(currentRecord.installments || []), newInstallment];
      const updates = {
        paidAmount: newPaidAmount,
        remainingFee: newRemainingFee,
        paymentStatus: paymentStatus,
        installments: updatedInstallments,
      };

      if (!isSuperAdmin(user?.role)) {
        await createApprovalRequest(user!, {
          actionType: "fee_modification",
          targetId: currentRecord.id,
          targetLabel: `${currentRecord.studentName} — Fee Payment`,
          remarks: `Payment of ₹${amountPaid} — status: ${paymentStatus}`,
          payload: { feeId: currentRecord.id, updates },
        });
        setShowPaymentModal(false);
        alert("Fee update submitted for Super Admin approval. Status: Pending Approval.");
        return;
      }

      await updateDoc(docRef, updates);
      await syncStudentFeeMirror({
        studentId: currentRecord.studentId || currentRecord.id,
        studentName: currentRecord.studentName,
        course: currentRecord.course,
        totalFee: currentRecord.totalFee,
        paidAmount: newPaidAmount,
        remainingFee: newRemainingFee,
        paymentStatus,
        dueDate: currentRecord.dueDate || currentRecord.nextDueDate,
        nextDueDate: currentRecord.nextDueDate || currentRecord.dueDate,
        installmentType: currentRecord.installmentType,
        installments: updatedInstallments,
      });
      await logAudit(user, "fee_updated", { resourceId: currentRecord.id, details: paymentStatus });
      setShowPaymentModal(false);
      fetchFeeRecords();
    } catch (error) {
      console.error("Error adding payment: ", error);
      alert("Failed to save payment.");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this fee record? This will permanently remove all payment history for this student.")) {
      await deleteDoc(doc(db, "student_fees", id));
      fetchFeeRecords();
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  const filteredRecords = feeRecords.filter(r => {
    const matchesSearch = r.studentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.studentId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.course?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === "All" || r.paymentStatus === filterStatus;
    return matchesSearch && matchesFilter;
  });

  return (
    <PageTransition>
      <div className={pageHeader}>
        <div>
          <h1 className={pageTitle}>Fee Management</h1>
          <p className={pageSubtitle}>Track payments, issue receipts, and manage student accounts. New fees are auto-generated via Admissions.</p>
        </div>
        <button type="button" onClick={() => setShowCreateModal(true)} className={btnPrimaryBlock}>
          <Plus size={18} /> Create Fee Record
        </button>
      </div>

      {/* Analytics Dashboard */}
      {loading ? (
        <div className="flex justify-center items-center h-32 mb-8">
          <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className={statsGrid}>
          <StatCard title="Total Revenue" value={formatCurrency(stats.totalRevenue)} icon={Wallet} delay={0.1} />
          <StatCard title="Pending Fees" value={formatCurrency(stats.pendingFees)} icon={Banknote} delay={0.2} trendUp={false} />
          <StatCard title="Collected This Month" value={formatCurrency(stats.collectedThisMonth)} icon={CreditCard} delay={0.3} trendUp={true} />
          <div className="glass-card p-4 sm:p-5 rounded-2xl flex flex-col justify-between col-span-2 md:col-span-1">
            <h3 className="text-slate-500 text-sm font-medium mb-2">Student Statuses</h3>
            <div className="space-y-2 mt-auto">
              <div className="flex justify-between items-center text-sm">
                <span className="text-emerald-600 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Fully Paid</span>
                <span className="text-slate-900 font-bold">{stats.studentsPaid}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-blue-600 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /> Partial</span>
                <span className="text-slate-900 font-bold">{stats.studentsPartial}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-red-600 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /> Pending</span>
                <span className="text-slate-900 font-bold">{stats.studentsPending}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table Filters */}
      <div className="glass-card rounded-2xl p-3 sm:p-4 mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search by ID, Name, or Course..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={inputClass + " pl-10"}
          />
        </div>
        <div className="admin-table-scroll flex gap-1.5 p-1 rounded-xl bg-slate-50 border border-slate-200 w-full sm:w-auto">
          {["All", "Paid", "Partial", "Pending"].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilterStatus(status)}
              className={`shrink-0 px-3 sm:px-4 py-2 rounded-lg text-sm transition-colors ${filterStatus === status ? "bg-white text-[#6C3CE9] font-medium shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden mb-8">
        <div className="admin-table-scroll">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Student Info</th>
                <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Total Fee</th>
                <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Paid Amount</th>
                <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Remaining</th>
                <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">Loading fee records...</td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">No records found.</td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr key={record.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 sm:px-6 py-4">
                      <div className="font-medium text-slate-900">{record.studentName}</div>
                      <div className="text-xs text-[#6C3CE9] font-mono mt-1">{record.studentId}</div>
                      <div className="text-xs text-slate-400 mt-1">{record.course}</div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-slate-900 font-medium">{formatCurrency(record.totalFee)}</td>
                    <td className="px-4 sm:px-6 py-4 text-emerald-600 font-medium">{formatCurrency(record.paidAmount)}</td>
                    <td className="px-4 sm:px-6 py-4 text-red-600 font-medium">{formatCurrency(record.remainingFee)}</td>
                    <td className="px-4 sm:px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        record.paymentStatus === "Paid" ? "bg-emerald-100 text-emerald-700" :
                        record.paymentStatus === "Partial" ? "bg-blue-100 text-blue-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {record.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 sm:gap-2">
                        {record.paymentStatus !== "Paid" && (
                          <button
                            type="button"
                            onClick={() => { setCurrentRecord(record); setShowPaymentModal(true); }}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Add Payment"
                          >
                            <CreditCard size={16} />
                          </button>
                        )}
                        <Link
                          href={`/secure-admin/fees/${record.studentId}`}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors inline-flex"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </Link>
                        {user?.role === "Super Admin" && (
                          <button
                            type="button"
                            onClick={() => handleDelete(record.id)}
                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Delete Record"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create Fee Record */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white w-full sm:max-w-3xl max-h-[92dvh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-slate-200 overflow-hidden shadow-xl relative">
            <div className={modalHeader}>
              <h2 className="text-lg sm:text-xl font-semibold text-slate-900">Create Fee Record</h2>
              <button type="button" onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 p-1 shrink-0">
                <X size={22} />
              </button>
            </div>
            <div className={`${modalBody} flex flex-col gap-6`}>
              {!fetchedStudent && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h3 className="text-slate-900 font-medium mb-3">1. Select Student</h3>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <input
                      type="text"
                      value={studentIdInput}
                      onChange={(e) => setStudentIdInput(e.target.value)}
                      placeholder="Enter Student ID (e.g. VIT-STU-001)"
                      className={inputClass + " font-mono uppercase flex-1"}
                    />
                    <button
                      type="button"
                      onClick={handleFetchStudent}
                      disabled={fetchingStudent || !studentIdInput}
                      className={btnPrimary + " w-full sm:w-auto shrink-0"}
                    >
                      {fetchingStudent ? "Searching..." : "Fetch"}
                    </button>
                  </div>
                  {fetchError && <p className="text-red-600 text-sm mt-2 flex items-center gap-1"><X size={14} /> {fetchError}</p>}
                </div>
              )}
              {fetchedStudent && (
                <form id="createFeeForm" onSubmit={handleCreateFee} className="space-y-6">
                  <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                    <div>
                      <p className="text-sm text-emerald-700 flex items-center gap-1"><CheckCircle size={16} /> Verified Student</p>
                      <p className="text-slate-900 font-medium mt-1">{fetchedStudent.fullName} • <span className="text-slate-500">{fetchedStudent.course}</span></p>
                    </div>
                    <button type="button" onClick={() => setFetchedStudent(null)} className="text-xs text-red-600 hover:text-red-700 self-start sm:self-auto">Change</button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className={labelClass}>Total Course Fee (₹)</label><input name="totalFee" type="number" min="0" required className={inputClass} /></div>
                    <div><label className={labelClass}>Discount (₹)</label><input name="discount" type="number" min="0" defaultValue={0} className={inputClass} /></div>
                    <div><label className={labelClass}>Installment Type</label>
                      <select name="installmentType" className={selectClass}>
                        <option value="Monthly">Monthly</option>
                        <option value="Quarterly">Quarterly</option>
                        <option value="One Time">One Time</option>
                        <option value="Custom">Custom</option>
                      </select>
                    </div>
                    <div><label className={labelClass}>Initial Admission Fee Paid (₹)</label><input name="admissionFee" type="number" min="0" defaultValue={0} className={inputClass} /></div>
                    <div><label className={labelClass}>Payment Method</label>
                      <select name="paymentMethod" className={selectClass}>
                        <option value="Cash">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Card">Card</option>
                      </select>
                    </div>
                    <div><label className={labelClass}>Transaction ID (if applicable)</label><input name="transactionId" placeholder="N/A" className={inputClass} /></div>
                    <div><label className={labelClass}>Next Payment Due Date</label><input name="dueDate" type="date" required className={inputClass} /></div>
                    <div className="sm:col-span-2"><label className={labelClass}>Notes</label><input name="notes" placeholder="Optional notes" className={inputClass} /></div>
                  </div>
                </form>
              )}
            </div>
            <div className={modalFooter}>
              {!fetchedStudent ? (
                <button type="button" onClick={() => setShowCreateModal(false)} className={btnSecondaryBlock}>Close</button>
              ) : (
                <>
                  <button type="button" onClick={() => setShowCreateModal(false)} className={btnSecondaryBlock}>Cancel</button>
                  <button
                    type="button"
                    onClick={() => {
                      const form = document.getElementById("createFeeForm") as HTMLFormElement;
                      if (form) form.requestSubmit();
                    }}
                    className={btnPrimaryBlock}
                  >
                    Create Fee Record
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Payment */}
      {showPaymentModal && currentRecord && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white w-full sm:max-w-lg max-h-[92dvh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-slate-200 overflow-hidden shadow-xl relative">
            <div className={modalHeader}>
              <h2 className="text-lg sm:text-xl font-semibold text-slate-900">Add Payment</h2>
              <button type="button" onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600 p-1 shrink-0">
                <X size={22} />
              </button>
            </div>
            <div className={modalBody}>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-4 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <p className="text-sm text-slate-500">Student</p>
                  <p className="text-slate-900 font-medium">{currentRecord.studentName}</p>
                </div>
                <div className="sm:text-right">
                  <p className="text-sm text-slate-500">Remaining Balance</p>
                  <p className="text-red-600 font-bold text-lg">{formatCurrency(currentRecord.remainingFee)}</p>
                </div>
              </div>
              <form id="paymentForm" onSubmit={handleAddPayment} className="space-y-4">
                <div>
                  <label className={labelClass}>Amount Paid (₹)</label>
                  <input name="amount" type="number" min="1" max={currentRecord.remainingFee} required className={inputClass + " text-lg font-semibold"} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Payment Method</label>
                    <select name="method" className={selectClass}>
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Card">Card</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Date</label>
                    <input name="date" type="date" defaultValue={new Date().toISOString().split("T")[0]} required className={inputClass} />
                  </div>
                </div>
                <div><label className={labelClass}>Transaction ID</label><input name="transactionId" placeholder="Optional" className={inputClass} /></div>
                <div><label className={labelClass}>Notes</label><input name="notes" placeholder="Optional" className={inputClass} /></div>
              </form>
            </div>
            <div className={modalFooter}>
              <button type="button" onClick={() => setShowPaymentModal(false)} className={btnSecondaryBlock}>Cancel</button>
              <button
                type="button"
                onClick={() => {
                  const form = document.getElementById("paymentForm") as HTMLFormElement;
                  if (form) form.requestSubmit();
                }}
                className={btnPrimaryBlock}
              >
                Save Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  );
}