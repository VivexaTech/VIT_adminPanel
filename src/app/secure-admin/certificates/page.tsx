"use client";

import { useState, useEffect } from "react";
import PageTransition from "@/components/admin/PageTransition";
import { Search, Plus, Trash2, ExternalLink, ImageIcon } from "lucide-react";
import { collection, getDocs, deleteDoc, doc, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { btnPrimaryBlock, inputClass, pageHeader, pageHeaderActions, pageTitle, pageSubtitle } from "@/lib/theme";

export default function CertificatesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

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

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this certificate?")) {
      await deleteDoc(doc(db, "certificates", id));
      fetchCertificates();
    }
  };

  const filteredCerts = certificates.filter(c =>
    c.studentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.certificateId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.course?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <PageTransition>
      <div className={pageHeader}>
        <div>
          <h1 className={pageTitle}>Certificates Management</h1>
          <p className={pageSubtitle}>Issue and manage smart credentials.</p>
        </div>
        <div className={pageHeaderActions}>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search ID, Name, Course..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={inputClass + " pl-10"}
            />
          </div>
          <button type="button" onClick={() => router.push("/secure-admin/certificates/generate")} className={btnPrimaryBlock}>
            <Plus size={18} />
            Issue Certificate
          </button>
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="admin-table-scroll">
          <table className="w-full text-left border-collapse min-w-[720px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Student Name</th>
                <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Certificate ID</th>
                <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Course</th>
                <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Issue Date</th>
                <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">Loading data...</td>
                </tr>
              ) : filteredCerts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">No certificates found.</td>
                </tr>
              ) : (
                filteredCerts.map((cert) => (
                  <tr key={cert.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 sm:px-6 py-4 font-medium text-slate-900">{cert.studentName}</td>
                    <td className="px-4 sm:px-6 py-4 text-[#6C3CE9] font-mono text-sm">{cert.certificateId}</td>
                    <td className="px-4 sm:px-6 py-4 text-slate-600 text-sm">{cert.course}</td>
                    <td className="px-4 sm:px-6 py-4 text-slate-500 text-sm">{cert.issueDate}</td>
                    <td className="px-4 sm:px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 sm:gap-2">
                        {cert.certificateImage && (
                          <a href={cert.certificateImage} target="_blank" rel="noreferrer" className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="View Image">
                            <ImageIcon size={16} />
                          </a>
                        )}
                        {cert.certificatePdf && (
                          <a href={cert.certificatePdf} target="_blank" rel="noreferrer" className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View PDF">
                            <ExternalLink size={16} />
                          </a>
                        )}
                        {user?.role === "Super Admin" && (
                          <button type="button" onClick={() => handleDelete(cert.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
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
    </PageTransition>
  );
}