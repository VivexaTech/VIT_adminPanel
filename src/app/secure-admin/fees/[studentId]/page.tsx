"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { subscribeToSettings, DEFAULT_SETTINGS } from "@/lib/settingsService";
import { generateReceiptId } from "@/lib/firebaseUtils";
import { buildReceiptHtml } from "@/lib/receiptTemplate";
import ReceiptPreviewModal from "@/components/admin/ReceiptPreviewModal";
import type { InstituteSettings } from "@/types/erp";
import { ArrowLeft, Printer, CreditCard, Calendar } from "lucide-react";

export default function StudentFeeDetails() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.studentId as string;

  const [feeRecord, setFeeRecord] = useState<any>(null);
  const [studentDetails, setStudentDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [instituteSettings, setInstituteSettings] = useState<InstituteSettings>(DEFAULT_SETTINGS);
  const [receiptPreview, setReceiptPreview] = useState<{
    receiptNo: string;
    receiptHtml: string;
    studentId: string;
  } | null>(null);
  const [generating, setGenerating] = useState(false);

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
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const handleGenerateReceipt = async (installment: any, index: number) => {
    if (!feeRecord) return;
    setGenerating(true);
    try {
      const receiptNo = await generateReceiptId();
      const previouslyPaid = (feeRecord.installments || [])
        .slice(0, index)
        .reduce((sum: number, inst: any) => sum + (Number(inst.amount) || 0), 0);

      const payableFee = Number(feeRecord.totalFee) || 0;
      const discountAmt = Number(feeRecord.discount) || 0;
      const originalFee =
        Number(feeRecord.originalFee) > 0
          ? Number(feeRecord.originalFee)
          : payableFee + discountAmt;
      const receiptHtml = buildReceiptHtml({
        receiptNo,
        date: installment.date,
        paymentDate: installment.date,
        studentName: feeRecord.studentName,
        studentId: feeRecord.studentId || studentId,
        mobile: studentDetails?.phone || "",
        courseName: feeRecord.course || "",
        batchName: studentDetails?.batch || feeRecord.batch || "",
        feeType: "Course Fee Payment",
        paymentMode: installment.method || "—",
        transactionRef:
          installment.transactionId && installment.transactionId !== "N/A"
            ? installment.transactionId
            : "",
        lineItems: [
          {
            description: installment.note || "Course Fee Installment / Payment",
            amount: Number(installment.amount) || 0,
          },
        ],
        originalFee,
        discount: discountAmt,
        totalFee: payableFee,
        previouslyPaid,
        currentPayment: Number(installment.amount) || 0,
        remainingBalance: Math.max(
          0,
          payableFee - previouslyPaid - (Number(installment.amount) || 0)
        ),
        logoUrl: instituteSettings.logoUrl,
        authorizedSignatureUrl: instituteSettings.authorizedSignatureUrl,
        instituteName: instituteSettings.instituteName,
        institutePhone: instituteSettings.phone,
        instituteEmail: instituteSettings.email,
        instituteAddress: instituteSettings.address,
      });

      setReceiptPreview({
        receiptNo,
        receiptHtml,
        studentId: feeRecord.studentId || studentId,
      });
    } catch (error) {
      console.error("Failed to generate receipt", error);
      alert("Failed to generate receipt.");
    } finally {
      setGenerating(false);
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
        <button
          type="button"
          onClick={() => router.push("/secure-admin/fees")}
          className="mt-4 px-4 py-2.5 brand-gradient text-white rounded-xl"
        >
          Go Back
        </button>
      </div>
    );
  }

  const progressPercentage =
    Math.min(100, Math.round((feeRecord.paidAmount / feeRecord.totalFee) * 100)) || 0;

  return (
    <>
      <div className="min-h-[80vh]">
        <button
          onClick={() => router.push("/secure-admin/fees")}
          className="flex items-center gap-2 text-slate-500 hover:text-[#6C3CE9] mb-6 transition-colors"
        >
          <ArrowLeft size={16} /> Back to Fees
        </button>

        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-1/3 space-y-6">
            <div className="glass-card p-4 sm:p-6 rounded-2xl">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full brand-gradient flex items-center justify-center text-xl sm:text-2xl font-bold text-white shadow-sm shrink-0">
                  {feeRecord.studentName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                    {feeRecord.studentName}
                  </h2>
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
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      feeRecord.paymentStatus === "Paid"
                        ? "bg-emerald-100 text-emerald-700"
                        : feeRecord.paymentStatus === "Partial"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-red-100 text-red-700"
                    }`}
                  >
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
                  <p className="text-slate-900 font-bold text-lg sm:text-xl">
                    {formatCurrency(feeRecord.totalFee)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500 text-xs">Paid</p>
                  <p className="text-emerald-600 font-bold text-lg sm:text-xl">
                    {formatCurrency(feeRecord.paidAmount)}
                  </p>
                </div>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-4">
                <div
                  className="h-full brand-gradient rounded-full transition-all duration-1000"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 text-sm">
                <span className="text-slate-500">{progressPercentage}% Complete</span>
                <span className="text-red-600 font-medium">
                  Due: {formatCurrency(feeRecord.remainingFee)}
                </span>
              </div>
            </div>
          </div>

          <div className="w-full md:w-2/3">
            <div className="glass-card p-4 sm:p-6 rounded-2xl h-full">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Calendar className="text-[#6C3CE9]" size={20} /> Transaction History
              </h3>

              {feeRecord.installments && feeRecord.installments.length > 0 ? (
                <div className="space-y-4 sm:space-y-6">
                  {feeRecord.installments.map((inst: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:border-[#6C3CE9]/30 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-full brand-gradient flex items-center justify-center text-white shrink-0">
                            <CreditCard size={14} />
                          </div>
                          <h4 className="font-bold text-lg text-slate-900">
                            {formatCurrency(inst.amount)}
                          </h4>
                        </div>
                        <span className="text-xs text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200 self-start">
                          {new Date(inst.date).toLocaleDateString("en-IN")}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-1 text-sm">
                        <span className="text-[#6C3CE9]">{inst.method}</span>
                        <span className="text-slate-400 font-mono text-xs break-all">
                          {inst.transactionId}
                        </span>
                      </div>
                      {inst.note && (
                        <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-200">
                          {inst.note}
                        </p>
                      )}
                      <button
                        type="button"
                        disabled={generating}
                        onClick={() => handleGenerateReceipt(inst, idx)}
                        className="mt-4 w-full flex justify-center items-center gap-2 py-2.5 bg-violet-50 hover:bg-violet-100 text-[#6C3CE9] rounded-xl text-sm transition-colors border border-violet-200 disabled:opacity-60"
                      >
                        <Printer size={14} />
                        {generating ? "Generating..." : "View / Download Invoice"}
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

      <ReceiptPreviewModal
        open={!!receiptPreview}
        receiptNo={receiptPreview?.receiptNo || ""}
        studentId={receiptPreview?.studentId || ""}
        receiptHtml={receiptPreview?.receiptHtml || ""}
        onClose={() => setReceiptPreview(null)}
      />
    </>
  );
}
