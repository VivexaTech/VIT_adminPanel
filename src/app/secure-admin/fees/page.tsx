"use client";

import { useState, useEffect } from "react";
import PageTransition from "@/components/admin/PageTransition";
import StatCard from "@/components/admin/StatCard";
import { Search, Plus, Edit2, Trash2, X, CheckCircle, Wallet, CreditCard, Banknote, Users, Eye } from "lucide-react";
import { collection, getDocs, deleteDoc, doc, setDoc, query, orderBy, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

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
        method: formData.get("paymentMethod") || "Cash",
        transactionId: formData.get("transactionId") || "N/A",
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
      method: formData.get("method"),
      transactionId: formData.get("transactionId") || "N/A",
      date: formData.get("date") || new Date().toISOString(),
      note: formData.get("notes") || ""
    };

    try {
      const docRef = doc(db, "student_fees", currentRecord.id);
      await updateDoc(docRef, {
        paidAmount: newPaidAmount,
        remainingFee: newRemainingFee,
        paymentStatus: paymentStatus,
        installments: [...(currentRecord.installments || []), newInstallment]
      });
      
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Fee Management</h1>
          <p className="text-gray-400 text-sm">Track payments, issue receipts, and manage student accounts. (New fees auto-generated via Admissions)</p>
        </div>
      </div>

      {/* Analytics Dashboard */}
      {loading ? (
        <div className="flex justify-center items-center h-32 mb-8">
          <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard title="Total Revenue" value={formatCurrency(stats.totalRevenue)} icon={Wallet} delay={0.1} />
          <StatCard title="Pending Fees" value={formatCurrency(stats.pendingFees)} icon={Banknote} delay={0.2} trendUp={false} />
          <StatCard title="Collected This Month" value={formatCurrency(stats.collectedThisMonth)} icon={CreditCard} delay={0.3} trendUp={true} />
          <div className="glass-panel p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between">
            <h3 className="text-gray-400 text-sm font-medium mb-2">Student Statuses</h3>
            <div className="space-y-2 mt-auto">
              <div className="flex justify-between items-center text-sm">
                <span className="text-emerald-400 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-400"></div> Fully Paid</span>
                <span className="text-white font-bold">{stats.studentsPaid}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-cyan-400 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-cyan-400"></div> Partial</span>
                <span className="text-white font-bold">{stats.studentsPartial}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-red-400 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-400"></div> Pending</span>
                <span className="text-white font-bold">{stats.studentsPending}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table Filters */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text"
            placeholder="Search by ID, Name, or Course..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#0A1121] border border-cyan-500/20 rounded-xl text-white focus:outline-none focus:border-cyan-400 transition-colors"
          />
        </div>
        <div className="flex gap-2 bg-[#0A1121] p-1 rounded-xl border border-cyan-500/20">
          {['All', 'Paid', 'Partial', 'Pending'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${filterStatus === status ? 'bg-cyan-500/20 text-cyan-400 font-medium' : 'text-gray-400 hover:text-white'}`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Fee Records Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-cyan-500/20 mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-cyan-500/20 bg-[#0A1121]/50">
                <th className="px-6 py-4 text-sm font-medium text-gray-400">Student Info</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-400">Total Fee</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-400">Paid Amount</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-400">Remaining</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-400">Status</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">Loading fee records...</td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">No records found.</td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr key={record.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{record.studentName}</div>
                      <div className="text-xs text-cyan-400 font-mono mt-1">{record.studentId}</div>
                      <div className="text-xs text-gray-500 mt-1">{record.course}</div>
                    </td>
                    <td className="px-6 py-4 text-white font-medium">{formatCurrency(record.totalFee)}</td>
                    <td className="px-6 py-4 text-emerald-400 font-medium">{formatCurrency(record.paidAmount)}</td>
                    <td className="px-6 py-4 text-red-400 font-medium">{formatCurrency(record.remainingFee)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        record.paymentStatus === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                        record.paymentStatus === 'Partial' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                        'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {record.paymentStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {record.paymentStatus !== 'Paid' && (
                          <button 
                            onClick={() => { setCurrentRecord(record); setShowPaymentModal(true); }}
                            className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                            title="Add Payment"
                          >
                            <CreditCard size={16} />
                          </button>
                        )}
                        <Link 
                          href={`/secure-admin/fees/${record.studentId}`}
                          className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </Link>
                        {user?.role === 'Super Admin' && (
                          <button 
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-cyan-500/30 overflow-hidden shadow-2xl relative">
            <div className="p-6 border-b border-cyan-500/20 flex justify-between items-center bg-[#0A1121]/80 shrink-0">
              <h2 className="text-xl font-bold text-white">Create Fee Record</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar flex-1">
              {/* Step 1: Fetch Student */}
              {!fetchedStudent && (
                <div className="bg-[#050B14] p-4 rounded-xl border border-cyan-500/30">
                  <h3 className="text-white font-medium mb-3">1. Select Student</h3>
                  <div className="flex gap-3">
                    <input 
                      type="text" 
                      value={studentIdInput}
                      onChange={(e) => setStudentIdInput(e.target.value)}
                      placeholder="Enter Student ID (e.g. VIT-STU-001)" 
                      className="flex-1 px-4 py-2 bg-[#0A1121] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400 font-mono uppercase"
                    />
                    <button 
                      onClick={handleFetchStudent}
                      disabled={fetchingStudent || !studentIdInput}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {fetchingStudent ? 'Searching...' : 'Fetch'}
                    </button>
                  </div>
                  {fetchError && <p className="text-red-400 text-sm mt-2 flex items-center gap-1"><X size={14}/> {fetchError}</p>}
                </div>
              )}

              {/* Step 2: Form */}
              {fetchedStudent && (
                <form id="createFeeForm" onSubmit={handleCreateFee} className="space-y-6">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl flex justify-between items-center">
                    <div>
                      <p className="text-sm text-emerald-400 flex items-center gap-1"><CheckCircle size={16}/> Verified Student</p>
                      <p className="text-white font-medium mt-1">{fetchedStudent.fullName} • <span className="text-gray-400">{fetchedStudent.course}</span></p>
                    </div>
                    <button type="button" onClick={() => setFetchedStudent(null)} className="text-xs text-red-400 hover:text-red-300">Change</button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Total Course Fee (₹)</label>
                      <input name="totalFee" type="number" min="0" required className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Discount (₹)</label>
                      <input name="discount" type="number" min="0" defaultValue={0} className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Installment Type</label>
                      <select name="installmentType" className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400 appearance-none">
                        <option value="Monthly">Monthly</option>
                        <option value="Quarterly">Quarterly</option>
                        <option value="One Time">One Time</option>
                        <option value="Custom">Custom</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Initial Admission Fee Paid (₹)</label>
                      <input name="admissionFee" type="number" min="0" defaultValue={0} className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Payment Method</label>
                      <select name="paymentMethod" className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400 appearance-none">
                        <option value="Cash">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Card">Card</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Transaction ID (if applicable)</label>
                      <input name="transactionId" placeholder="N/A" className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Next Payment Due Date</label>
                      <input name="dueDate" type="date" required className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-300 mb-1">Notes</label>
                      <input name="notes" placeholder="Optional notes" className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400" />
                    </div>
                  </div>
                </form>
              )}
              </div>
            </div>
            
            <div className="p-4 flex justify-end gap-3 bg-[#0A1121]/90 border-t border-cyan-500/20 shrink-0">
              {!fetchedStudent ? (
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-gray-400 hover:text-white transition-colors">
                  Close
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-gray-400 hover:text-white transition-colors">
                    Cancel
                  </button>
                  <button onClick={() => {
                    const form = document.getElementById('createFeeForm') as HTMLFormElement;
                    if(form) form.requestSubmit();
                  }} className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl transition-colors shadow-[0_0_10px_rgba(16,185,129,0.3)]">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl border border-cyan-500/30 overflow-hidden shadow-2xl relative">
            <div className="p-6 border-b border-cyan-500/20 flex justify-between items-center bg-[#0A1121]/80 shrink-0">
              <h2 className="text-xl font-bold text-white">Add Payment</h2>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                <div className="flex justify-between items-center mb-6 bg-[#050B14] p-4 rounded-xl border border-cyan-500/20">
                  <div>
                    <p className="text-sm text-gray-400">Student</p>
                    <p className="text-white font-medium">{currentRecord.studentName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-400">Remaining Balance</p>
                    <p className="text-red-400 font-bold text-lg">{formatCurrency(currentRecord.remainingFee)}</p>
                  </div>
                </div>

                <form id="paymentForm" onSubmit={handleAddPayment} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Amount Paid (₹)</label>
                    <input name="amount" type="number" min="1" max={currentRecord.remainingFee} required className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400 text-lg font-bold" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Payment Method</label>
                      <select name="method" className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400 appearance-none">
                        <option value="Cash">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Card">Card</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Date</label>
                      <input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} required className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Transaction ID</label>
                    <input name="transactionId" placeholder="Optional" className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Notes</label>
                    <input name="notes" placeholder="Optional" className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400" />
                  </div>
                </form>
              </div>
            </div>
            
            <div className="p-4 flex justify-end gap-3 bg-[#0A1121]/90 border-t border-cyan-500/20 shrink-0">
              <button type="button" onClick={() => setShowPaymentModal(false)} className="px-4 py-2 text-gray-400 hover:text-white transition-colors">
                Cancel
              </button>
              <button onClick={() => {
                const form = document.getElementById('paymentForm') as HTMLFormElement;
                if(form) form.requestSubmit();
              }} className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl transition-colors shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                Save Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  );
}