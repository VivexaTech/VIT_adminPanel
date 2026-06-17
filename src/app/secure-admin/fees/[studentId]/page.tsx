"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { subscribeToSettings, DEFAULT_SETTINGS } from "@/lib/settingsService";
import { generateReceiptId } from "@/lib/firebaseUtils";
import type { InstituteSettings } from "@/types/erp";
import { ArrowLeft, Printer, Download, CreditCard, Calendar, ShieldCheck, MapPin } from "lucide-react";

export default function StudentFeeDetails() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.studentId as string;
  
  const [feeRecord, setFeeRecord] = useState<any>(null);
  const [studentDetails, setStudentDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Receipt generation state
  const [printingReceipt, setPrintingReceipt] = useState<any>(null);
  const [receiptNumber, setReceiptNumber] = useState<string>("");
  const [instituteSettings, setInstituteSettings] = useState<InstituteSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const unsub = subscribeToSettings(setInstituteSettings);
    return () => unsub();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const feeDoc = await getDoc(doc(db, "student_fees", studentId));
        if (feeDoc.exists()) {
          setFeeRecord(feeDoc.data());
        }

        const studentDoc = await getDoc(doc(db, "students", studentId));
        if (studentDoc.exists()) {
          setStudentDetails(studentDoc.data());
        }
      } catch (error) {
        console.error("Error fetching details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [studentId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  const handlePrintReceipt = async (installment: any) => {
    try {
      // Create a unique receipt ID on the fly for printing
      const newReceiptId = await generateReceiptId();
      setReceiptNumber(newReceiptId);
      setPrintingReceipt(installment);
      
      // Give React time to render the print container before calling window.print
      setTimeout(() => {
        window.print();
        // Reset after print dialog closes
        setTimeout(() => setPrintingReceipt(null), 1000);
      }, 500);
    } catch (error) {
      console.error("Failed to generate receipt ID", error);
      alert("Failed to generate receipt.");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="w-12 h-12 border-4 border-[#6C3CE9] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!feeRecord) {
    return (
      <div className="p-8 text-center min-h-[60vh]">
        <h2 className="text-xl sm:text-2xl font-bold text-red-600">Fee Record Not Found</h2>
        <button type="button" onClick={() => router.push("/secure-admin/fees")} className="mt-4 px-4 py-2.5 brand-gradient text-white rounded-xl">Go Back</button>
      </div>
    );
  }

  const progressPercentage = Math.min(100, Math.round((feeRecord.paidAmount / feeRecord.totalFee) * 100)) || 0;

  return (
    <>
      <div className="no-print min-h-[80vh]">
        <button 
          onClick={() => router.push('/secure-admin/fees')}
          className="flex items-center gap-2 text-slate-500 hover:text-[#6C3CE9] mb-6 transition-colors"
        >
          <ArrowLeft size={16} /> Back to Fees
        </button>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Left Column: Student Details & Progress */}
          <div className="w-full md:w-1/3 space-y-6">
            <div className="glass-card p-4 sm:p-6 rounded-2xl">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full brand-gradient flex items-center justify-center text-xl sm:text-2xl font-bold text-white shadow-sm shrink-0">
                  {feeRecord.studentName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 truncate">{feeRecord.studentName}</h2>
                  <p className="text-[#6C3CE9] font-mono text-sm">{feeRecord.studentId}</p>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
                  <span className="text-slate-500 shrink-0">Course</span>
                  <span className="text-slate-900 font-medium text-right">{feeRecord.course}</span>
                </div>
                {studentDetails && (
                  <>
                    <div className="flex justify-between border-b border-slate-100 pb-2">
                      <span className="text-slate-500">Phone</span>
                      <span className="text-slate-900">{studentDetails.phone}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-2">
                      <span className="text-slate-500">Join Date</span>
                      <span className="text-slate-900">{studentDetails.joinDate}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between pt-2">
                  <span className="text-slate-500">Status</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    feeRecord.paymentStatus === "Paid" ? "bg-emerald-100 text-emerald-700" :
                    feeRecord.paymentStatus === "Partial" ? "bg-blue-100 text-blue-700" :
                    "bg-red-100 text-red-700"
                  }`}>
                    {feeRecord.paymentStatus}
                  </span>
                </div>
              </div>
            </div>

            <div className="glass-card p-4 sm:p-6 rounded-2xl">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Payment Progress</h3>
              <div className="flex justify-between items-end mb-2 gap-4">
                <div>
                  <p className="text-slate-500 text-xs">Total Fee</p>
                  <p className="text-slate-900 font-bold text-lg sm:text-xl">{formatCurrency(feeRecord.totalFee)}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500 text-xs">Paid</p>
                  <p className="text-emerald-600 font-bold text-lg sm:text-xl">{formatCurrency(feeRecord.paidAmount)}</p>
                </div>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-4">
                <div className="h-full brand-gradient rounded-full transition-all duration-1000" style={{ width: `${progressPercentage}%` }} />
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 text-sm">
                <span className="text-slate-500">{progressPercentage}% Complete</span>
                <span className="text-red-600 font-medium">Due: {formatCurrency(feeRecord.remainingFee)}</span>
              </div>
            </div>
          </div>

          {/* Right Column: History */}
          <div className="w-full md:w-2/3">
            <div className="glass-card p-4 sm:p-6 rounded-2xl h-full">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Calendar className="text-[#6C3CE9]" size={20} /> Transaction History
              </h3>
              
              {feeRecord.installments && feeRecord.installments.length > 0 ? (
                <div className="space-y-4 sm:space-y-6">
                  {feeRecord.installments.map((inst: any, idx: number) => (
                    <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:border-[#6C3CE9]/30 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-full brand-gradient flex items-center justify-center text-white shrink-0">
                            <CreditCard size={14} />
                          </div>
                          <h4 className="font-bold text-lg text-slate-900">{formatCurrency(inst.amount)}</h4>
                        </div>
                        <span className="text-xs text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200 self-start">{new Date(inst.date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-1 text-sm">
                        <span className="text-[#6C3CE9]">{inst.method}</span>
                        <span className="text-slate-400 font-mono text-xs break-all">{inst.transactionId}</span>
                      </div>
                      {inst.note && <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-200">{inst.note}</p>}
                      <button
                        type="button"
                        onClick={() => handlePrintReceipt(inst)}
                        className="mt-4 w-full flex justify-center items-center gap-2 py-2.5 bg-violet-50 hover:bg-violet-100 text-[#6C3CE9] rounded-xl text-sm transition-colors border border-violet-200"
                      >
                        <Printer size={14} /> Generate Receipt
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <p>No transactions recorded yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hidden Print Container */}
      {printingReceipt && (
        <div className="print-receipt-container hidden">
          <div className="max-w-3xl mx-auto border-2 border-gray-200 p-8 rounded-none bg-white">
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-gray-200 pb-6 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 bg-blue-600 flex items-center justify-center rounded-lg text-white font-bold text-3xl">
                  V
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 m-0 leading-tight">Vivexa Institute of Technology</h1>
                  <p className="text-sm text-gray-500 m-0 flex items-center gap-1 mt-1"><MapPin size={12} /> Gurugram, Haryana, India</p>
                  <p className="text-sm text-gray-500 m-0">{instituteSettings.email} | {instituteSettings.phone}</p>
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-3xl font-black text-gray-200 uppercase tracking-widest m-0 leading-none mb-2">RECEIPT</h2>
                <p className="text-sm font-bold text-gray-900 m-0">Receipt No: <span className="font-mono font-normal text-gray-600">{receiptNumber}</span></p>
                <p className="text-sm font-bold text-gray-900 m-0">Date: <span className="font-normal text-gray-600">{new Date(printingReceipt.date).toLocaleDateString()}</span></p>
              </div>
            </div>

            {/* Student Info */}
            <div className="flex justify-between mb-8 print-bg-gray p-4 rounded-lg">
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Received From</p>
                <h3 className="font-bold text-lg text-gray-900 m-0">{feeRecord.studentName}</h3>
                <p className="text-sm text-gray-600 font-mono m-0 mt-1">ID: {feeRecord.studentId}</p>
                {studentDetails?.phone && <p className="text-sm text-gray-600 m-0">Ph: {studentDetails.phone}</p>}
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Course Details</p>
                <h3 className="font-bold text-lg text-gray-900 m-0">{feeRecord.course}</h3>
                <p className="text-sm text-gray-600 m-0 mt-1">Total Course Fee: {formatCurrency(feeRecord.totalFee)}</p>
              </div>
            </div>

            {/* Transaction Details */}
            <table className="w-full mb-8 text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-800">
                  <th className="py-2 text-gray-900 font-bold uppercase text-sm w-3/4">Description</th>
                  <th className="py-2 text-gray-900 font-bold uppercase text-sm text-right w-1/4">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="py-4">
                    <p className="font-medium text-gray-900 m-0">Course Fee Installment / Payment</p>
                    <p className="text-sm text-gray-500 m-0 mt-1">Method: {printingReceipt.method}</p>
                    {printingReceipt.transactionId !== "N/A" && (
                      <p className="text-sm text-gray-500 m-0">Txn ID: <span className="font-mono">{printingReceipt.transactionId}</span></p>
                    )}
                    {printingReceipt.note && (
                      <p className="text-sm text-gray-500 m-0 mt-1 italic">Note: {printingReceipt.note}</p>
                    )}
                  </td>
                  <td className="py-4 text-right font-bold text-gray-900 text-lg align-top">
                    {formatCurrency(printingReceipt.amount)}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Summary */}
            <div className="flex justify-end mb-16">
              <div className="w-1/2">
                <div className="flex justify-between py-1 text-sm">
                  <span className="text-gray-600">Total Paid (Till Date):</span>
                  <span className="font-medium text-gray-900">{formatCurrency(feeRecord.paidAmount)}</span>
                </div>
                <div className="flex justify-between py-1 text-sm border-b border-gray-200 mb-2">
                  <span className="text-gray-600">Remaining Balance:</span>
                  <span className="font-medium text-gray-900">{formatCurrency(feeRecord.remainingFee)}</span>
                </div>
                <div className="flex justify-between py-2 items-center bg-gray-50 p-2 rounded border border-gray-200">
                  <span className="font-bold text-gray-900">THIS PAYMENT:</span>
                  <span className="font-black text-2xl text-gray-900">{formatCurrency(printingReceipt.amount)}</span>
                </div>
              </div>
            </div>

            {/* Footer / Signature */}
            <div className="flex justify-between items-end mt-16 pt-8 border-t-2 border-gray-200">
              <div className="text-sm text-gray-500">
                <p className="flex items-center gap-1 font-medium"><ShieldCheck size={14}/> Digitally generated receipt.</p>
                <p>This document is valid without a physical signature.</p>
              </div>
              <div className="text-center">
                <div className="w-48 border-b border-gray-400 mb-2"></div>
                <p className="text-sm font-bold text-gray-900 uppercase tracking-widest">Authorized Signatory</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
