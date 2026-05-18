"use client";

import { useState, useEffect } from "react";
import PageTransition from "@/components/admin/PageTransition";
import { Search, Edit2, Trash2, X, Ban, CheckCircle } from "lucide-react";
import { collection, getDocs, deleteDoc, doc, setDoc, query, orderBy, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

export default function StudentsPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [currentStudent, setCurrentStudent] = useState<any>(null);

  const fetchStudents = async () => {
    try {
      const q = query(collection(db, "students"), orderBy("joinDate", "desc"));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudents(data);
    } catch (error) {
      console.error("Error fetching students: ", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentStudent) return; // Cannot create new student from here anymore
    
    const formData = new FormData(e.currentTarget);
    
    const data = {
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      course: formData.get("course"),
      address: formData.get("address"),
      qualification: formData.get("qualification"),
      status: formData.get("status"),
    };

    try {
      await updateDoc(doc(db, "students", currentStudent.id), data);
      setShowModal(false);
      fetchStudents();
    } catch (error) {
      console.error("Error updating student: ", error);
      alert("Failed to update student.");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this student? This action is irreversible.")) {
      await deleteDoc(doc(db, "students", id));
      fetchStudents();
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "Suspended" ? "Active" : "Suspended";
    if (window.confirm(`Are you sure you want to change this student's status to ${newStatus}?`)) {
      try {
        await updateDoc(doc(db, "students", id), { status: newStatus });
        fetchStudents();
      } catch (error) {
        console.error("Error toggling status", error);
      }
    }
  };

  const filteredStudents = students.filter(s => 
    s.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.studentId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.course?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <PageTransition>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Students Management</h1>
          <p className="text-gray-400 text-sm">Manage enrolled students. (Note: New students must be added via Admissions)</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#0A1121] border border-cyan-500/20 rounded-xl text-white focus:outline-none focus:border-cyan-400 transition-colors"
            />
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden border border-cyan-500/20">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-cyan-500/20 bg-[#0A1121]/50">
                <th className="px-6 py-4 text-sm font-medium text-gray-400">Student</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-400">ID</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-400">Course</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-400">Contact</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-400">Status</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">Loading...</td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">No students found.</td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{student.fullName}</div>
                      <div className="text-xs text-gray-500 mt-1">Joined {student.joinDate}</div>
                    </td>
                    <td className="px-6 py-4 text-cyan-400 font-mono font-medium">{student.studentId}</td>
                    <td className="px-6 py-4 text-gray-300">{student.course}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-300">{student.phone}</div>
                      <div className="text-xs text-gray-500">{student.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        student.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                        student.status === 'Suspended' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                        'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {student.status || 'Active'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => { setCurrentStudent(student); setShowModal(true); }}
                          title="Edit Student"
                          className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleToggleStatus(student.id, student.status)}
                          title={student.status === 'Suspended' ? 'Activate' : 'Suspend'}
                          className={`p-2 rounded-lg transition-colors ${student.status === 'Suspended' ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-yellow-400 hover:bg-yellow-500/10'}`}
                        >
                          {student.status === 'Suspended' ? <CheckCircle size={16} /> : <Ban size={16} />}
                        </button>
                        
                        {user?.role === 'Super Admin' && (
                          <button 
                            onClick={() => handleDelete(student.id)}
                            title="Delete Student"
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

      {showModal && currentStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-cyan-500/30 overflow-hidden shadow-2xl relative">
            <div className="p-6 border-b border-cyan-500/20 flex justify-between items-center bg-[#0A1121]/80 shrink-0">
              <h2 className="text-xl font-bold text-white">Edit Student Details</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Student ID (Read Only)</label>
                  <input name="studentId" defaultValue={currentStudent.studentId} disabled className="w-full px-4 py-2 bg-[#050B14]/50 border border-cyan-500/30 rounded-xl text-gray-500 focus:outline-none font-mono cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Full Name</label>
                  <input name="fullName" defaultValue={currentStudent.fullName} required className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
                  <input name="email" type="email" defaultValue={currentStudent.email} required className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Phone</label>
                  <input name="phone" defaultValue={currentStudent.phone} required className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Course</label>
                  <input name="course" defaultValue={currentStudent.course} required className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Qualification</label>
                  <input name="qualification" defaultValue={currentStudent.qualification} required className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Status</label>
                  <select name="status" defaultValue={currentStudent.status || "Active"} className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400 appearance-none">
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-400 mb-1">Address</label>
                  <input name="address" defaultValue={currentStudent.address} required className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400" />
                </div>
              </div>
              </div>
              
              <div className="p-4 flex justify-end gap-3 bg-[#0A1121]/90 border-t border-cyan-500/20 shrink-0">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-400 hover:text-white transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl transition-colors shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                  Update Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageTransition>
  );
}
