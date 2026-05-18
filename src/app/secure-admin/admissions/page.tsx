"use client";

import { useState, useEffect } from "react";
import PageTransition from "@/components/admin/PageTransition";
import { Search, Plus, Trash2, X, CheckCircle, Eye } from "lucide-react";
import { collection, getDocs, deleteDoc, doc, query, orderBy, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { generateStudentId } from "@/lib/firebaseUtils";

export default function AdmissionsPage() {
  const { user } = useAuth();
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Date states for auto-calculation
  const [admissionDate, setAdmissionDate] = useState(new Date().toISOString().split('T')[0]);
  const [nextDueDate, setNextDueDate] = useState("");

  const fetchAdmissions = async () => {
    try {
      const q = query(collection(db, "admissions"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAdmissions(data);
    } catch (error) {
      console.error("Error fetching admissions: ", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmissions();
  }, []);

  // Auto-calculate next due date when admission date changes
  useEffect(() => {
    if (admissionDate) {
      const date = new Date(admissionDate);
      date.setMonth(date.getMonth() + 1);
      setNextDueDate(date.toISOString().split('T')[0]);
    }
  }, [admissionDate]);

  const handleCreateAdmission = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);
      
      // 1. Generate new Student ID (e.g., ST001)
      const studentId = await generateStudentId();
      
      // Extract form data
      const fullName = formData.get("fullName") as string;
      const course = formData.get("course") as string;
      
      const totalFee = Number(formData.get("totalCourseFee"));
      const paidAmount = Number(formData.get("admissionFeePaid"));
      const discount = Number(formData.get("discount") || 0);
      const actualTotal = totalFee - discount;
      const remainingFee = actualTotal - paidAmount;
      
      let paymentStatus = "Pending";
      if (remainingFee <= 0) paymentStatus = "Paid";
      else if (paidAmount > 0) paymentStatus = "Partial";

      const batch = writeBatch(db);

      // 2. Prepare Admissions Document
      const admissionRef = doc(collection(db, "admissions"));
      batch.set(admissionRef, {
        studentId,
        fullName,
        fatherName: formData.get("fatherName"),
        email: formData.get("email"),
        phone: formData.get("phone"),
        course,
        qualification: formData.get("qualification"),
        address: formData.get("address"),
        city: formData.get("city"),
        state: formData.get("state"),
        admissionDate: formData.get("admissionDate"),
        courseDuration: formData.get("courseDuration"),
        notes: formData.get("notes"),
        createdAt: serverTimestamp()
      });

      // 3. Prepare Student Document (Auto-create)
      const studentRef = doc(db, "students", studentId);
      batch.set(studentRef, {
        studentId,
        fullName,
        email: formData.get("email"),
        phone: formData.get("phone"),
        course,
        address: `${formData.get("address")}, ${formData.get("city")}, ${formData.get("state")}`,
        qualification: formData.get("qualification"),
        joinDate: formData.get("admissionDate"),
        status: "Active",
        createdAt: serverTimestamp()
      });

      // 4. Prepare Fee Record Document (Auto-create)
      const installments = [];
      if (paidAmount > 0) {
        installments.push({
          amount: paidAmount,
          method: formData.get("paymentMethod"),
          transactionId: "Initial Admission",
          date: formData.get("admissionDate"),
          note: "Admission Fee Paid"
        });
      }

      const feeRef = doc(db, "student_fees", studentId);
      batch.set(feeRef, {
        studentId,
        studentName: fullName,
        course,
        totalFee: actualTotal,
        originalFee: totalFee,
        discount,
        paidAmount,
        remainingFee: Math.max(0, remainingFee),
        paymentStatus,
        admissionDate: formData.get("admissionDate"),
        nextDueDate: formData.get("nextDueDate"),
        installments,
        createdAt: serverTimestamp()
      });

      // Execute all 3 writes atomically
      await batch.commit();

      setShowModal(false);
      fetchAdmissions();
    } catch (error) {
      console.error("Error processing admission: ", error);
      alert("Failed to process admission.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this admission log? (Note: This does not delete the student or fee record)")) {
      await deleteDoc(doc(db, "admissions", id));
      fetchAdmissions();
    }
  };

  const filteredAdmissions = admissions.filter(a => 
    a.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.studentId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.course?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <PageTransition>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Admission Entry System</h1>
          <p className="text-gray-400 text-sm">Register new students. Automatically generates student IDs and fee ledgers.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Search admissions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#0A1121] border border-cyan-500/20 rounded-xl text-white focus:outline-none focus:border-cyan-400 transition-colors"
            />
          </div>
          <button 
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl hover:from-cyan-400 hover:to-blue-500 transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] shrink-0"
          >
            <Plus size={18} />
            <span className="hidden sm:block">New Admission</span>
          </button>
        </div>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden border border-cyan-500/20">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-cyan-500/20 bg-[#0A1121]/50">
                <th className="px-6 py-4 text-sm font-medium text-gray-400">Student ID</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-400">Applicant</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-400">Course</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-400">Contact</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-400">Date</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">Loading records...</td>
                </tr>
              ) : filteredAdmissions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">No admissions found.</td>
                </tr>
              ) : (
                filteredAdmissions.map((admission) => (
                  <tr key={admission.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 text-cyan-400 font-mono font-medium">{admission.studentId}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{admission.fullName}</div>
                      <div className="text-xs text-gray-500 mt-1">D/O, S/O: {admission.fatherName}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-300">{admission.course}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-300">{admission.phone}</div>
                      <div className="text-xs text-gray-500">{admission.email}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-300 text-sm">{admission.admissionDate}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {user?.role === 'Super Admin' && (
                          <button 
                            onClick={() => handleDelete(admission.id)}
                            title="Delete Log"
                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors ml-2"
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

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-cyan-500/30 overflow-hidden shadow-2xl relative">
            <div className="p-6 border-b border-cyan-500/20 flex justify-between items-center bg-[#0A1121]/80 shrink-0">
              <div>
                <h2 className="text-xl font-bold text-white">New Student Admission</h2>
                <p className="text-xs text-gray-400 mt-1">System will auto-generate Student ID and Fee Records.</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleCreateAdmission} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              
              {/* Personal Details */}
              <div>
                <h3 className="text-cyan-400 font-medium mb-3 border-b border-cyan-500/20 pb-2">1. Personal Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Full Name</label>
                    <input name="fullName" required className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Father's Name</label>
                    <input name="fatherName" required className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
                    <input name="email" type="email" required className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Phone Number</label>
                    <input name="phone" required className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Highest Qualification</label>
                    <input name="qualification" required className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400" />
                  </div>
                </div>
              </div>

              {/* Address Details */}
              <div>
                <h3 className="text-cyan-400 font-medium mb-3 border-b border-cyan-500/20 pb-2">2. Address Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-400 mb-1">Street Address</label>
                    <input name="address" required className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-400 mb-1">City</label>
                    <input name="city" required className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">State</label>
                    <input name="state" required className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400" />
                  </div>
                </div>
              </div>

              {/* Course & Fee Details */}
              <div>
                <h3 className="text-cyan-400 font-medium mb-3 border-b border-cyan-500/20 pb-2">3. Course & Fee Setup</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Course Enrolled</label>
                    <input name="course" required className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Course Duration</label>
                    <input name="courseDuration" placeholder="e.g., 6 Months, 1 Year" required className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Admission Date</label>
                    <input name="admissionDate" type="date" value={admissionDate} onChange={(e) => setAdmissionDate(e.target.value)} required className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Next Payment Due Date (Auto 1 Month)</label>
                    <input name="nextDueDate" type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} required className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Total Course Fee (₹)</label>
                    <input name="totalCourseFee" type="number" min="0" required className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Discount Given (₹)</label>
                    <input name="discount" type="number" min="0" defaultValue="0" className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Admission Fee Paid (₹)</label>
                    <input name="admissionFeePaid" type="number" min="0" defaultValue="0" className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Payment Method</label>
                    <select name="paymentMethod" className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400 appearance-none">
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Card">Card</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-400 mb-1">Admission Notes / Remarks</label>
                    <input name="notes" className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400" />
                  </div>
                </div>
              </div>
              </div>
              
              <div className="p-4 flex justify-end gap-3 bg-[#0A1121]/90 border-t border-cyan-500/20 shrink-0">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-400 hover:text-white transition-colors">
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl transition-colors shadow-[0_0_10px_rgba(6,182,212,0.3)] disabled:opacity-50"
                >
                  {submitting ? 'Processing...' : 'Confirm Admission'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageTransition>
  );
}
