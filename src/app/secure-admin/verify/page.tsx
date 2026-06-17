"use client";

import { useState } from "react";
import PageTransition from "@/components/admin/PageTransition";
import { Search, CheckCircle, XCircle, Award, ExternalLink, Download } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { btnPrimary, inputClass, labelClass } from "@/lib/theme";

export default function VerifyToolPage() {
  const [certId, setCertId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!certId.trim()) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const docRef = doc(db, "certificates", certId.trim());
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setResult({ id: docSnap.id, ...docSnap.data() });
      } else {
        setError("Certificate not found. Please check the ID and try again.");
      }
    } catch (err) {
      console.error("Error verifying certificate: ", err);
      setError("An error occurred during verification.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">Certificate Verification</h1>
        <p className="text-slate-500 text-sm">Verify student credentials internally.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
        <div className="lg:col-span-1">
          <div className="glass-card p-4 sm:p-6 rounded-2xl">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Enter Details</h2>
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className={labelClass}>Certificate ID</label>
                <div className="relative">
                  <Award className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6C3CE9]" size={18} />
                  <input
                    type="text"
                    placeholder="e.g., VIT-2026-001"
                    value={certId}
                    onChange={(e) => setCertId(e.target.value)}
                    className={inputClass + " pl-10 py-3 font-mono"}
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || !certId.trim()}
                className={btnPrimary + " w-full py-3 disabled:opacity-50"}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Search size={18} />
                    <span>Verify Now</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2">
          {error && (
            <div className="glass-card p-6 sm:p-8 rounded-2xl border border-red-200 flex flex-col items-center justify-center text-center h-full min-h-[240px] sm:min-h-[300px]">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
                <XCircle className="text-red-500" size={32} />
              </div>
              <h3 className="text-xl font-bold text-red-600 mb-2">Verification Failed</h3>
              <p className="text-slate-500">{error}</p>
            </div>
          )}

          {!error && !result && !loading && (
            <div className="glass-card p-6 sm:p-8 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-center h-full min-h-[240px] sm:min-h-[300px] bg-slate-50/50">
              <Award className="text-[#6C3CE9]/40 mb-4" size={48} />
              <h3 className="text-lg font-medium text-slate-700">Awaiting Search</h3>
              <p className="text-sm text-slate-500 max-w-xs mt-2">Enter a valid certificate ID to view the candidate&apos;s credentials.</p>
            </div>
          )}

          {result && (
            <div className="glass-card rounded-2xl overflow-hidden relative">
              <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 bg-emerald-50/50">
                <div>
                  <div className="flex items-center gap-2 text-emerald-700 mb-1">
                    <CheckCircle size={18} />
                    <span className="font-bold tracking-wide uppercase text-sm">Verified Authentic</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900">{result.studentName}</h3>
                  <p className="text-[#6C3CE9] font-mono mt-1 text-sm">{result.certificateId}</p>
                </div>
                {result.pdfUrl && (
                  <a
                    href={result.pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-[#6C3CE9] rounded-xl text-sm text-slate-700 transition-colors w-full sm:w-auto shrink-0"
                  >
                    <Download size={16} />
                    <span>Download PDF</span>
                  </a>
                )}
              </div>
              <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Course Details</p>
                    <p className="text-lg font-medium text-slate-900">{result.courseName}</p>
                    <p className="text-sm text-slate-500 mt-1">{result.duration} • Grade: <span className="text-[#6C3CE9] font-bold">{result.grade}</span></p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Contact Info</p>
                    <p className="text-sm text-slate-900">{result.email}</p>
                    <p className="text-sm text-slate-500">{result.phone}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Completion</p>
                      <p className="text-sm text-slate-900">{new Date(result.completionDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Issued</p>
                      <p className="text-sm text-slate-900">{new Date(result.issueDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col min-h-[200px]">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Certificate Image</p>
                  {result.imageUrl ? (
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 group flex-1 bg-slate-50">
                      <img src={result.imageUrl} alt="Certificate Preview" className="w-full h-full object-cover" />
                      <a
                        href={result.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <span className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg text-slate-900 text-sm">
                          <ExternalLink size={16} /> Open Full Size
                        </span>
                      </a>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center border border-dashed border-slate-200 rounded-xl bg-slate-50">
                      <p className="text-sm text-slate-400">No image available</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
