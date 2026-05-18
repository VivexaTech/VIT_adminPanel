"use client";

import { useState } from "react";
import PageTransition from "@/components/admin/PageTransition";
import { Search, CheckCircle, XCircle, Award, ExternalLink, Download } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

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
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Certificate Verification</h1>
        <p className="text-gray-400 text-sm">Verify student credentials internally.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="glass-panel p-6 rounded-2xl border border-cyan-500/20">
            <h2 className="text-lg font-bold text-white mb-4">Enter Details</h2>
            
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Certificate ID</label>
                <div className="relative">
                  <Award className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500" size={18} />
                  <input 
                    type="text"
                    placeholder="e.g., VIT-2026-001"
                    value={certId}
                    onChange={(e) => setCertId(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-[#0A1121] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_10px_rgba(6,182,212,0.2)] transition-all font-mono"
                    required
                  />
                </div>
              </div>
              
              <button 
                type="submit"
                disabled={loading || !certId.trim()}
                className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl font-medium shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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
            <div className="glass-panel p-8 rounded-2xl border border-red-500/30 flex flex-col items-center justify-center text-center h-full min-h-[300px]">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                <XCircle className="text-red-500" size={32} />
              </div>
              <h3 className="text-xl font-bold text-red-400 mb-2">Verification Failed</h3>
              <p className="text-gray-400">{error}</p>
            </div>
          )}

          {!error && !result && !loading && (
            <div className="glass-panel p-8 rounded-2xl border border-dashed border-cyan-500/30 flex flex-col items-center justify-center text-center h-full min-h-[300px] bg-white/5">
              <Award className="text-cyan-500/50 mb-4" size={48} />
              <h3 className="text-lg font-medium text-gray-300">Awaiting Search</h3>
              <p className="text-sm text-gray-500 max-w-xs mt-2">Enter a valid certificate ID on the left to view the candidate's credentials.</p>
            </div>
          )}

          {result && (
            <div className="glass-panel rounded-2xl border border-cyan-500/30 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
              
              <div className="p-6 border-b border-cyan-500/20 flex justify-between items-start bg-gradient-to-r from-emerald-500/10 to-transparent">
                <div>
                  <div className="flex items-center gap-2 text-emerald-400 mb-1">
                    <CheckCircle size={18} />
                    <span className="font-bold tracking-wide uppercase text-sm">Verified Authentic</span>
                  </div>
                  <h3 className="text-2xl font-bold text-white">{result.studentName}</h3>
                  <p className="text-cyan-400 font-mono mt-1">{result.certificateId}</p>
                </div>
                
                {result.pdfUrl && (
                  <a 
                    href={result.pdfUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-[#050B14] border border-cyan-500/30 hover:border-cyan-400 rounded-lg text-sm text-white transition-colors"
                  >
                    <Download size={16} />
                    <span>Download PDF</span>
                  </a>
                )}
              </div>
              
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Course Details</p>
                    <p className="text-lg font-medium text-white">{result.courseName}</p>
                    <p className="text-sm text-gray-400 mt-1">{result.duration} • Grade: <span className="text-cyan-400 font-bold">{result.grade}</span></p>
                  </div>
                  
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Contact Info</p>
                    <p className="text-sm text-white">{result.email}</p>
                    <p className="text-sm text-gray-400">{result.phone}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Completion</p>
                      <p className="text-sm text-white">{new Date(result.completionDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Issued</p>
                      <p className="text-sm text-white">{new Date(result.issueDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Certificate Image</p>
                  {result.imageUrl ? (
                    <div className="relative rounded-xl overflow-hidden border border-cyan-500/20 group flex-1 bg-[#050B14]">
                      <img 
                        src={result.imageUrl} 
                        alt="Certificate Preview" 
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                      />
                      <a 
                        href={result.imageUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <span className="flex items-center gap-2 bg-white/10 backdrop-blur border border-white/20 px-4 py-2 rounded-lg text-white">
                          <ExternalLink size={16} /> Open Full Size
                        </span>
                      </a>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center border border-dashed border-cyan-500/30 rounded-xl bg-[#050B14]">
                      <p className="text-sm text-gray-500">No image available</p>
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
