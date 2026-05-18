"use client";

import { useState, useEffect } from "react";
import PageTransition from "@/components/admin/PageTransition";
import { Search, Plus, Edit2, Trash2, X, Upload, ExternalLink, Image as ImageIcon, FileText, CheckCircle } from "lucide-react";
import { collection, getDocs, deleteDoc, doc, setDoc, query, orderBy, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { generateCertificateId } from "@/lib/firebaseUtils";
import { useAuth } from "@/context/AuthContext";

export default function CertificatesPage() {
  const { user } = useAuth();
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [currentCert, setCurrentCert] = useState<any>(null);
  
  // Smart Form State
  const [studentIdInput, setStudentIdInput] = useState("");
  const [fetchingStudent, setFetchingStudent] = useState(false);
  const [fetchedStudent, setFetchedStudent] = useState<any>(null);
  const [fetchError, setFetchError] = useState("");
  
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [certificateImage, setCertificateImage] = useState("");
  const [certificatePdf, setCertificatePdf] = useState("");

  const fetchCertificates = async () => {
    try {
      const q = query(collection(db, "certificates"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCertificates(data);
    } catch (error) {
      console.error("Error fetching certificates: ", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCertificates();
  }, []);

  const handleFetchStudent = async () => {
    if (!studentIdInput.trim()) return;
    setFetchingStudent(true);
    setFetchError("");
    setFetchedStudent(null);
    
    try {
      // 1. Check if student exists
      const docRef = doc(db, "students", studentIdInput.trim());
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        setFetchError("Student ID not found");
        setFetchingStudent(false);
        return;
      }

      // 2. Check fee status
      const feeRef = doc(db, "student_fees", studentIdInput.trim());
      const feeSnap = await getDoc(feeRef);
      
      if (feeSnap.exists()) {
        const feeData = feeSnap.data();
        if (feeData.remainingFee > 0) {
          setFetchError(`Certificate cannot be issued. Student fee is pending (₹${feeData.remainingFee} remaining).`);
          setFetchingStudent(false);
          return;
        }
      } else {
        setFetchError("Fee record not found for this student. Please check fee management.");
        setFetchingStudent(false);
        return;
      }

      setFetchedStudent({ id: docSnap.id, ...docSnap.data() });
    } catch (error) {
      setFetchError("Error fetching student details");
    } finally {
      setFetchingStudent(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'pdf') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === 'image') setUploadingImage(true);
    else setUploadingPdf(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "");

    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/upload`,
        { method: "POST", body: formData }
      );
      const data = await response.json();
      
      if (type === 'image') setCertificateImage(data.secure_url);
      else setCertificatePdf(data.secure_url);
    } catch (error) {
      console.error(`Error uploading ${type}: `, error);
      alert(`Failed to upload ${type}. Ensure Cloudinary keys are set.`);
    } finally {
      if (type === 'image') setUploadingImage(false);
      else setUploadingPdf(false);
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!fetchedStudent && !currentCert) {
      alert("Please fetch a valid student first.");
      return;
    }

    const formData = new FormData(e.currentTarget);
    const saveBtn = e.currentTarget.querySelector('button[type="submit"]') as HTMLButtonElement;
    saveBtn.disabled = true;
    saveBtn.innerHTML = "Saving...";

    try {
      let certId = currentCert?.certificateId;
      
      if (!certId) {
        // Auto-generate ID for new certificate
        certId = await generateCertificateId();
      }

      const data = {
        certificateId: certId,
        studentId: fetchedStudent?.studentId || currentCert?.studentId,
        studentName: fetchedStudent?.fullName || currentCert?.studentName,
        course: fetchedStudent?.course || currentCert?.course,
        email: fetchedStudent?.email || currentCert?.email,
        phone: fetchedStudent?.phone || currentCert?.phone,
        
        completionDate: formData.get("completionDate"),
        issueDate: formData.get("issueDate"),
        duration: formData.get("duration"),
        grade: formData.get("grade"),
        status: formData.get("status"),
        
        certificateImage: certificateImage || currentCert?.certificateImage || "",
        certificatePdf: certificatePdf || currentCert?.certificatePdf || "",
        instituteName: "Vivexa Institute of Technology",
        createdAt: currentCert?.createdAt || serverTimestamp(),
      };

      // Use certificateId as document ID
      await setDoc(doc(db, "certificates", certId), data);
      setShowModal(false);
      fetchCertificates();
    } catch (error) {
      console.error("Error saving certificate: ", error);
      alert("Failed to save certificate.");
      saveBtn.disabled = false;
      saveBtn.innerHTML = "Save Certificate";
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this certificate?")) {
      await deleteDoc(doc(db, "certificates", id));
      fetchCertificates();
    }
  };

  const openModal = (cert: any = null) => {
    setCurrentCert(cert);
    if (cert) {
      setStudentIdInput(cert.studentId);
      setFetchedStudent({
        studentId: cert.studentId,
        fullName: cert.studentName,
        course: cert.course,
        email: cert.email,
        phone: cert.phone,
      });
      setCertificateImage(cert.certificateImage || "");
      setCertificatePdf(cert.certificatePdf || "");
    } else {
      setStudentIdInput("");
      setFetchedStudent(null);
      setCertificateImage("");
      setCertificatePdf("");
    }
    setFetchError("");
    setShowModal(true);
  };

  const filteredCerts = certificates.filter(c => 
    c.studentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.certificateId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.course?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <PageTransition>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Certificates Management</h1>
          <p className="text-gray-400 text-sm">Issue and manage smart credentials.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Search ID, Name, Course..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#0A1121] border border-cyan-500/20 rounded-xl text-white focus:outline-none focus:border-cyan-400 transition-colors"
            />
          </div>
          <button 
            onClick={() => openModal()}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl hover:from-cyan-400 hover:to-blue-500 transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] shrink-0"
          >
            <Plus size={18} />
            <span className="hidden sm:block">Issue Certificate</span>
          </button>
        </div>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden border border-cyan-500/20">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-cyan-500/20 bg-[#0A1121]/50">
                <th className="px-6 py-4 text-sm font-medium text-gray-400">Student Name</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-400">Certificate ID</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-400">Course</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-400">Issue Date</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-400">Status</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">Loading actual data...</td>
                </tr>
              ) : filteredCerts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">No certificates found.</td>
                </tr>
              ) : (
                filteredCerts.map((cert) => (
                  <tr key={cert.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-medium text-white">{cert.studentName}</td>
                    <td className="px-6 py-4 text-cyan-400 font-mono text-sm">{cert.certificateId}</td>
                    <td className="px-6 py-4 text-gray-300 text-sm">{cert.course}</td>
                    <td className="px-6 py-4 text-gray-400 text-sm">{cert.issueDate}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        cert.status === 'Verified' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                        'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                      }`}>
                        {cert.status || 'Verified'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {cert.certificatePdf && (
                          <a 
                            href={cert.certificatePdf} 
                            target="_blank" 
                            rel="noreferrer"
                            className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                            title="View PDF"
                          >
                            <ExternalLink size={16} />
                          </a>
                        )}
                        <button 
                          onClick={() => openModal(cert)}
                          className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        {user?.role === 'Super Admin' && (
                          <button 
                            onClick={() => handleDelete(cert.id)}
                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
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
          <div className="glass-panel w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-cyan-500/30 overflow-hidden shadow-2xl relative">
            <div className="p-6 border-b border-cyan-500/20 flex justify-between items-center bg-[#0A1121]/80 shrink-0">
              <h2 className="text-xl font-bold text-white">{currentCert ? 'Edit Certificate' : 'Issue Smart Certificate'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar flex-1">
              {/* Step 1: Fetch Student */}
              {!currentCert && (
                <div className="bg-[#050B14] p-4 rounded-xl border border-cyan-500/30">
                  <h3 className="text-white font-medium mb-3">1. Fetch Student Details</h3>
                  <div className="flex gap-3">
                    <input 
                      type="text" 
                      value={studentIdInput}
                      onChange={(e) => setStudentIdInput(e.target.value)}
                      placeholder="Enter Student ID (e.g. VIT-STU-001)" 
                      className="flex-1 px-4 py-2 bg-[#0A1121] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400 font-mono"
                      disabled={!!fetchedStudent}
                    />
                    {!fetchedStudent ? (
                      <button 
                        onClick={handleFetchStudent}
                        disabled={fetchingStudent || !studentIdInput}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {fetchingStudent ? 'Searching...' : 'Fetch'}
                      </button>
                    ) : (
                      <button 
                        onClick={() => {
                          setFetchedStudent(null);
                          setStudentIdInput("");
                        }}
                        className="px-6 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-xl transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  {fetchError && <p className="text-red-400 text-sm mt-2 flex items-center gap-1"><X size={14}/> {fetchError}</p>}
                  {fetchedStudent && <p className="text-emerald-400 text-sm mt-2 flex items-center gap-1"><CheckCircle size={14}/> Student verified automatically.</p>}
                </div>
              )}

              {/* Step 2: Form */}
              {(fetchedStudent || currentCert) && (
                <form id="certForm" onSubmit={handleSave} className="space-y-6">
                  {currentCert && (
                    <div className="bg-cyan-500/10 border border-cyan-500/20 p-4 rounded-xl mb-6">
                      <p className="text-sm text-cyan-400 font-mono">Editing Certificate ID: <strong>{currentCert.certificateId}</strong></p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Read-only Auto-filled Data */}
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Student Name</label>
                      <input value={fetchedStudent?.fullName || currentCert?.studentName} disabled className="w-full px-4 py-2 bg-[#050B14]/50 border border-gray-700 rounded-xl text-gray-400 cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Course Name</label>
                      <input value={fetchedStudent?.course || currentCert?.course} disabled className="w-full px-4 py-2 bg-[#050B14]/50 border border-gray-700 rounded-xl text-gray-400 cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Email</label>
                      <input value={fetchedStudent?.email || currentCert?.email} disabled className="w-full px-4 py-2 bg-[#050B14]/50 border border-gray-700 rounded-xl text-gray-400 cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Phone</label>
                      <input value={fetchedStudent?.phone || currentCert?.phone} disabled className="w-full px-4 py-2 bg-[#050B14]/50 border border-gray-700 rounded-xl text-gray-400 cursor-not-allowed" />
                    </div>

                    {/* Admin Input Fields */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Completion Date</label>
                      <input name="completionDate" type="date" defaultValue={currentCert?.completionDate} required className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Issue Date</label>
                      <input name="issueDate" type="date" defaultValue={currentCert?.issueDate || new Date().toISOString().split('T')[0]} required className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Duration</label>
                      <input name="duration" defaultValue={currentCert?.duration} placeholder="e.g., 6 Months" required className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Grade</label>
                      <input name="grade" defaultValue={currentCert?.grade} placeholder="e.g., A+" required className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                      <select name="status" defaultValue={currentCert?.status || "Verified"} className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400 appearance-none">
                        <option value="Verified">Verified</option>
                        <option value="Pending">Pending</option>
                      </select>
                    </div>
                  </div>

                  {/* Upload Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-cyan-500/20 mt-4">
                    <div className="bg-[#0A1121] p-4 rounded-xl border border-dashed border-cyan-500/30">
                      <label className="flex flex-col items-center justify-center cursor-pointer">
                        <ImageIcon className="text-gray-400 mb-2" size={24} />
                        <span className="text-sm text-gray-400">Upload Image (Cloudinary)</span>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'image')} />
                      </label>
                      {uploadingImage && <p className="text-xs text-cyan-400 mt-2 text-center">Uploading image...</p>}
                      {certificateImage && <p className="text-xs text-emerald-400 mt-2 text-center truncate">Image Uploaded: Ready</p>}
                    </div>
                    
                    <div className="bg-[#0A1121] p-4 rounded-xl border border-dashed border-cyan-500/30">
                      <label className="flex flex-col items-center justify-center cursor-pointer">
                        <FileText className="text-gray-400 mb-2" size={24} />
                        <span className="text-sm text-gray-400">Upload PDF (Cloudinary)</span>
                        <input type="file" accept="application/pdf" className="hidden" onChange={(e) => handleFileUpload(e, 'pdf')} />
                      </label>
                      {uploadingPdf && <p className="text-xs text-cyan-400 mt-2 text-center">Uploading PDF...</p>}
                      {certificatePdf && <p className="text-xs text-emerald-400 mt-2 text-center truncate">PDF Uploaded: Ready</p>}
                    </div>
                  </div>
                </form>
              )}
              </div>
            </div>
            
            <div className="p-4 flex justify-end gap-3 bg-[#0A1121]/90 border-t border-cyan-500/20 shrink-0">
              {(!fetchedStudent && !currentCert) ? (
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-400 hover:text-white transition-colors">
                  Close
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-400 hover:text-white transition-colors">
                    Cancel
                  </button>
                  <button onClick={() => {
                    const form = document.getElementById('certForm') as HTMLFormElement;
                    if(form) form.requestSubmit();
                  }} className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl transition-colors shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                    {currentCert ? "Update Certificate" : "Issue & Generate ID"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  );
}
