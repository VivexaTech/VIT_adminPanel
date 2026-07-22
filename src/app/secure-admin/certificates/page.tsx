"use client";

import { useState, useEffect } from "react";
import PageTransition from "@/components/admin/PageTransition";
import { Search, Plus, Trash2, Eye, Download, Printer, X } from "lucide-react";
import { collection, getDocs, deleteDoc, doc, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useToast } from "@/context/ToastContext";
import { jsPDF } from "jspdf";
import { btnPrimaryBlock, inputClass, pageHeader, pageHeaderActions, pageTitle, pageSubtitle } from "@/lib/theme";

type CertificateRow = {
  id: string;
  studentName?: string;
  certificateId?: string;
  course?: string;
  issueDate?: string;
  certificateImage?: string;
  certificatePdf?: string;
};

export default function CertificatesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [certificates, setCertificates] = useState<CertificateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchCertificates = async () => {
    try {
      const q = query(collection(db, "certificates"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() } as CertificateRow));
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
    if (!window.confirm("Are you sure you want to delete this certificate?")) return;
    await deleteDoc(doc(db, "certificates", id));
    fetchCertificates();
  };

  const handleDownloadPng = async (cert: CertificateRow) => {
    if (!cert.certificateImage) {
      showToast("error", "No certificate image available.");
      return;
    }
    setBusyId(cert.id);
    try {
      const res = await fetch(cert.certificateImage);
      if (!res.ok) throw new Error("Failed to fetch image");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${cert.certificateId || cert.id}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      showToast("error", "Failed to download certificate PNG.");
    } finally {
      setBusyId(null);
    }
  };

  const handlePrintPdf = async (cert: CertificateRow) => {
    if (!cert.certificateImage) {
      showToast("error", "No certificate image available.");
      return;
    }
    setBusyId(cert.id);
    try {
      const res = await fetch(cert.certificateImage);
      if (!res.ok) throw new Error("Failed to fetch image");
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Failed to read image"));
        reader.readAsDataURL(blob);
      });

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      pdf.addImage(dataUrl, "PNG", 0, 0, pageWidth, pageHeight);
      pdf.autoPrint();
      window.open(pdf.output("bloburl"), "_blank");
    } catch (err) {
      console.error(err);
      showToast("error", "Failed to generate print PDF.");
    } finally {
      setBusyId(null);
    }
  };

  const filteredCerts = certificates.filter(
    (c) =>
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
                          <>
                            <button
                              type="button"
                              onClick={() => setViewImage(cert.certificateImage || null)}
                              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="View"
                              disabled={busyId === cert.id}
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadPng(cert)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Download PNG"
                              disabled={busyId === cert.id}
                            >
                              <Download size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePrintPdf(cert)}
                              className="p-2 text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                              title="Print PDF"
                              disabled={busyId === cert.id}
                            >
                              <Printer size={16} />
                            </button>
                          </>
                        )}
                        {user?.role === "Super Admin" && (
                          <button
                            type="button"
                            onClick={() => handleDelete(cert.id)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
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

      {viewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-5xl max-h-[90dvh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Certificate Preview</h3>
              <button
                type="button"
                onClick={() => setViewImage(null)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 overflow-auto bg-slate-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={viewImage} alt="Certificate" className="w-full h-auto rounded-lg border border-slate-200" />
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  );
}
