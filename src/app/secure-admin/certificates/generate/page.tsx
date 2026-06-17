"use client";

import { useState, useRef, useEffect } from "react";
import PageTransition from "@/components/admin/PageTransition";
import {
  UploadCloud,
  Printer,
  Search,
  CheckCircle,
  X,
  Loader2,
} from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { QRCodeSVG } from "qrcode.react";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  setDoc,
  serverTimestamp,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { btnPrimary, btnSecondary, inputClass, labelClass } from "@/lib/theme";
import { checkCertificateEligibility, type CertificateEligibility } from "@/lib/certificateEligibility";
import { issueCertificate, studentHasCertificate } from "@/lib/certificateService";
import { useAuth } from "@/context/AuthContext";
import { logAudit } from "@/lib/auditService";

export default function CertificateGeneratorPage() {
  const router = useRouter();
  const { user } = useAuth();
  const certRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // States
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingState, setProcessingState] = useState("");
  const [scale, setScale] = useState(1);

  const [studentIdInput, setStudentIdInput] = useState("");
  const [fetchingStudent, setFetchingStudent] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [fetchedStudent, setFetchedStudent] = useState<any>(null);
  const [eligibility, setEligibility] = useState<CertificateEligibility | null>(null);

  const [certData, setCertData] = useState({
    name: "Student Name",
    course: "Course Name",
    id: "VIT-2026-001",
    grade: "",
    duration: "6 Months",
    date: new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    url: "https://vit.vivexatech.in/verify",
  });

  // Calculate dynamic scale for preview
  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const { width } = containerRef.current.getBoundingClientRect();
        setScale(width / 3508); // 3508 is the base width
      }
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  const handleFetchStudent = async () => {
    if (!studentIdInput.trim()) return;
    setFetchingStudent(true);
    setFetchError("");

    try {
      const sid = studentIdInput.trim();
      let student: Record<string, unknown> | null = null;

      const studentSnap = await getDoc(doc(db, "students", sid));
      if (studentSnap.exists()) {
        student = { id: studentSnap.id, ...studentSnap.data() };
      } else {
        const q = query(collection(db, "admissions"), where("studentId", "==", sid));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
          setFetchError("Student ID not found in database.");
          setFetchingStudent(false);
          return;
        }
        student = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
      }

      const elig = await checkCertificateEligibility(sid);
      const alreadyIssued = await studentHasCertificate(sid, String(student.course || ""));
      if (alreadyIssued) {
        setFetchError("A certificate already exists for this student and course.");
        setFetchingStudent(false);
        return;
      }
      setEligibility(elig);

      const currentYear = new Date().getFullYear();
      const certsRef = collection(db, "certificates");

      const certQuery = query(
        certsRef,
        where("certificateId", ">=", `VIT-${currentYear}-`),
        where("certificateId", "<=", `VIT-${currentYear}-\uf8ff`),
        orderBy("certificateId", "desc"),
        limit(1),
      );

      const certSnap = await getDocs(certQuery);
      let nextNum = 1;

      if (!certSnap.empty) {
        const lastId = certSnap.docs[0].data().certificateId;
        const parts = lastId.split("-");
        if (parts.length === 3) {
          nextNum = parseInt(parts[2], 10) + 1;
        }
      }

      const newCertId = `VIT-${currentYear}-${nextNum.toString().padStart(3, "0")}`;

      setFetchedStudent(student);

      setCertData({
        name: String(student.fullName || ""),
        course: String(student.course || ""),
        id: newCertId,
        grade: "",
        duration: String(student.courseDuration || "6 Months"),
        date: new Date().toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        url: `https://vit.vivexatech.in/verify?id=${newCertId}`,
      });
    } catch (error) {
      console.error("Error fetching data:", error);
      setFetchError("Error fetching student details");
    } finally {
      setFetchingStudent(false);
    }
  };

  // ==========================================
  // BULLETPROOF OFF-SCREEN CAPTURE METHOD
  // ==========================================
// ==========================================
  // BULLETPROOF OFF-SCREEN CAPTURE METHOD
  // ==========================================
  const captureCertificate = async () => {
    setProcessingState("Generating high-res image...");
    const certElement = certRef.current;
    if (!certElement) throw new Error("Certificate container not found");

    // 1. Off-screen container (Fixed position to prevent scroll shifts)
    const printContainer = document.createElement("div");
    printContainer.style.position = "fixed"; // 'absolute' ki jagah 'fixed' use karein
    printContainer.style.top = "0px"; 
    printContainer.style.left = "0px";
    printContainer.style.zIndex = "-9999"; // Screen ke piche hide karein
    printContainer.style.opacity = "0"; // Invisible rakhein
    printContainer.style.pointerEvents = "none";
    printContainer.style.width = "3508px";
    printContainer.style.height = "2480px";

    // 2. Clone the original node
    const clone = certElement.cloneNode(true) as HTMLDivElement;
    clone.style.transform = "none"; // UI scaling hata dein
    clone.style.margin = "0";
    clone.style.padding = "0";

    printContainer.appendChild(clone);
    document.body.appendChild(printContainer);

    // 3. Wait for Web Fonts and DOM Updates
    await document.fonts.ready;
    await new Promise((resolve) => setTimeout(resolve, 300)); // Thoda extra time dein (300ms)

    try {
      return await html2canvas(clone, {
        scale: 1, 
        width: 3508, 
        height: 2480, 
        useCORS: true,
        backgroundColor: "#ffffff",
        windowWidth: 3508, 
        windowHeight: 2480, 
        scrollX: 0, // Very important: prevents horizontal shifting
        scrollY: 0, // Very important: prevents vertical text shifting
        logging: false,
      });
    } catch (error) {
      console.error("Capture error:", error);
      throw error;
    } finally {
      // 4. Cleanup
      if (document.body.contains(printContainer)) {
        document.body.removeChild(printContainer);
      }
    }
  };

  const uploadToCloudinary = (
    file: Blob,
    resourceType: "image" | "raw",
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      setProcessingState(`Uploading to Cloudinary...`);
      setUploadProgress(0);

      const formData = new FormData();
      formData.append("file", file);
      formData.append(
        "upload_preset",
        process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "",
      );

      const xhr = new XMLHttpRequest();
      xhr.open(
        "POST",
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
      );

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round(
            (event.loaded / event.total) * 100,
          );
          setUploadProgress(percentComplete);
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          resolve(response.secure_url);
        } else {
          reject(new Error("Upload failed"));
        }
      };

      xhr.onerror = () => reject(new Error("Network Error"));
      xhr.send(formData);
    });
  };

  const saveToFirebase = async (imageUrl: string, pdfUrl: string) => {
    setProcessingState("Saving to database...");
    await issueCertificate({
      certificateId: certData.id,
      studentId: studentIdInput.trim(),
      studentName: certData.name,
      course: certData.course,
      courseId: String(fetchedStudent?.enrolledCourse?.courseId || fetchedStudent?.courseId || ""),
      issueDate: certData.date,
      duration: certData.duration,
      grade: certData.grade,
      certificateImage: imageUrl,
      certificatePdf: pdfUrl,
      verifyUrl: certData.url,
    });
    await logAudit(user, "certificate_issued", {
      resource: "certificate",
      resourceId: certData.id,
      details: `${certData.name} — ${certData.course}`,
    });
  };

  const handlePrintPDF = async () => {
    if (!eligibility?.eligible) return alert("Student is not eligible for certificate issuance.");
    setIsProcessing(true);
    setUploadProgress(0);
    try {
      const canvas = await captureCertificate();
      setProcessingState("Preparing PDF...");
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [3508, 2480],
      });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 3508, 2480);
      pdf.autoPrint();
      window.open(pdf.output("bloburl"), "_blank");
    } catch (err) {
      console.error(err);
      alert("Print failed.");
    } finally {
      setIsProcessing(false);
      setProcessingState("");
    }
  };

  const handleUploadPNG = async () => {
    if (!eligibility?.eligible) return alert("Student is not eligible for certificate issuance.");
    if (!certData.grade) return alert("Please fill the grade manually.");
    setIsProcessing(true);
    try {
      const canvas = await captureCertificate();
      const blob = await (await fetch(canvas.toDataURL("image/png"))).blob();
      const imageUrl = await uploadToCloudinary(blob, "image");
      await saveToFirebase(imageUrl, "");
      alert("PNG Uploaded & Saved Successfully!");
      router.push("/secure-admin/certificates");
    } catch (err) {
      console.error(err);
      alert("PNG Upload failed.");
    } finally {
      setIsProcessing(false);
      setUploadProgress(0);
      setProcessingState("");
    }
  };

  return (
    <PageTransition>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">Issue Smart Certificate</h1>
        <p className="text-slate-500 text-sm">Fetch student details, assign grade, and export.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        <div className="lg:col-span-4">
          <div className="glass-card p-4 sm:p-6 rounded-2xl space-y-6 relative overflow-hidden">
            {isProcessing && (
              <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-6 text-center">
                <Loader2 className="w-10 h-10 text-[#6C3CE9] animate-spin mb-4" />
                <h3 className="text-slate-900 font-bold mb-2">{processingState}</h3>
                <div className="w-full bg-slate-100 rounded-full h-3 mb-2 overflow-hidden">
                  <div className="brand-gradient h-3 rounded-full transition-all duration-300 ease-out" style={{ width: `${uploadProgress}%` }} />
                </div>
                <p className="text-[#6C3CE9] font-mono text-sm">{uploadProgress}% Complete</p>
              </div>
            )}

            {/* Step 1: Fetch Student */}
            <div>
              <label className={labelClass}>1. Fetch Student</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={studentIdInput}
                  onChange={(e) => setStudentIdInput(e.target.value)}
                  placeholder="e.g. STO02"
                  disabled={!!fetchedStudent}
                  className={inputClass + " font-mono flex-1"}
                />
                {!fetchedStudent ? (
                  <button
                    type="button"
                    onClick={handleFetchStudent}
                    disabled={fetchingStudent || !studentIdInput}
                    className={btnPrimary + " px-4 shrink-0"}
                  >
                    <Search size={18} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setFetchedStudent(null);
                      setStudentIdInput("");
                      setEligibility(null);
                    }}
                    className="px-4 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-colors flex items-center justify-center shrink-0"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
              {fetchError && <p className="text-red-600 text-xs mt-2">{fetchError}</p>}
              {fetchedStudent && (
                <p className="text-emerald-700 text-xs mt-2 flex items-center gap-1">
                  <CheckCircle size={12} /> Verified & Auto-Generated ID:{" "}
                  {certData.id}
                </p>
              )}
            </div>

            {/* Step 2: Form */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div>
                <label className={labelClass}>Name</label>
                <input value={certData.name} disabled className={inputClass + " bg-slate-50 text-slate-500 cursor-not-allowed"} />
              </div>
              <div>
                <label className={labelClass}>Course</label>
                <input value={certData.course} disabled className={inputClass + " bg-slate-50 text-slate-500 cursor-not-allowed"} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Date (Auto)</label>
                  <input value={certData.date} disabled className={inputClass + " bg-slate-50 text-slate-500 cursor-not-allowed"} />
                </div>
                <div>
                  <label className={labelClass}>Grade *</label>
                  <input
                    type="text"
                    value={certData.grade}
                    onChange={(e) => setCertData({ ...certData, grade: e.target.value.toUpperCase() })}
                    placeholder="e.g. A+"
                    className={inputClass + " font-bold"}
                  />
                </div>
              </div>
            </div>

            {eligibility && !eligibility.eligible && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800 space-y-1">
                <p className="font-semibold">Certificate cannot be issued until all requirements are met:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {eligibility.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                {!eligibility.feesPaid && (
                  <p className="font-medium pt-1">Certificate cannot be issued until all fee payments are completed.</p>
                )}
              </div>
            )}
            {eligibility?.eligible && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-center gap-2">
                <CheckCircle size={16} /> Student is eligible for certificate issuance.
              </div>
            )}

            <div className="flex flex-col gap-3 pt-4 border-t border-slate-100">
              <button type="button" onClick={handleUploadPNG} disabled={!fetchedStudent || !eligibility?.eligible} className={btnPrimary + " w-full py-3 disabled:opacity-50"}>
                <UploadCloud size={18} /> Upload PNG (Cloudinary)
              </button>
              <button type="button" onClick={handlePrintPDF} disabled={!fetchedStudent || !eligibility?.eligible} className={btnSecondary + " w-full disabled:opacity-50"}>
                <Printer size={16} /> Print PDF
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel: Live Preview */}
        <div className="lg:col-span-8">
          <div
            className="bg-slate-100 border border-dashed border-slate-300 p-3 sm:p-6 rounded-2xl flex justify-center items-center overflow-x-auto"
            ref={containerRef}
            style={{ minHeight: "min(500px, 60dvh)" }}
          >
            <div
              style={{
                width: "100%",
                height: `${2480 * scale}px`,
                position: "relative",
              }}
            >
              <div
                id="scale-wrapper"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }}
              >
                <div
                  id="certificate-output"
                  ref={certRef}
                  className="shadow-2xl"
                  style={{
                    width: "3508px",
                    height: "2480px",
                    backgroundColor: "#ffffff",
                    position: "relative",
                    overflow: "hidden" 
                  }}
                >
                  <img
                    src="/certificate-template.svg"
                    alt="Template"
                    className="cert-bg absolute top-0 left-0 w-full h-full object-cover z-0 pointer-events-none"
                    crossOrigin="anonymous"
                  />

                  <div className="cert-layer student-name">{certData.name}</div>
                  <div className="cert-layer course-name text-[#C8922E]">
                    {certData.course}
                  </div>
                  <div className="cert-layer text-small duration text-black">
                    {certData.duration}
                  </div>
                  <div className="cert-layer text-small date text-black">
                    {certData.date}
                  </div>
                  <div className="cert-layer text-small id-num text-black">
                    {certData.id}
                  </div>
                  <div className="cert-layer text-small grade text-black">
                    {certData.grade || "-"}
                  </div>

                  <div className="cert-layer qr-code bg-white flex items-center justify-center">
                    {certData.url && (
                      <QRCodeSVG
                        value={certData.url}
                        size={256}
                        level="H"
                        style={{ width: "100%", height: "100%" }}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
  .cert-layer { 
    position: absolute; 
    z-index: 10; 
    color: #0A2A66; 
    font-family: 'Cormorant Garamond', serif; 
    white-space: nowrap; 
    line-height: 1; 
  }
  
  .student-name { 
    left: 0; 
    top: 40.5%; 
    width: 100%; 
    text-align: center; 
    font-size: 200px; 
    letter-spacing: 0.04em; 
    font-weight: 400; 
  }

  .course-name { 
    left: 10%; 
    top: 53.7%; 
    width: 80%; 
    text-align: center; 
    font-size: 91px; 
    font-weight: 400; 
    color: #C8922E; 
  }
  
  .text-small { 
    font-size: 45px; 
    font-weight: 600; 
    font-family: system-ui, -apple-system, sans-serif; 
    text-align: center; 
    color: black; 
    line-height: 1; 
  }

  .duration { top: 80.8%; left: 16%; width: 13%; }
  .date { top: 80.8%; left: 29.5%; width: 13%; }
  .id-num { top: 80.8%; left: 43.2%; width: 13%; }
  .grade { top: 80.8%; left: 57.5%; width: 13%; }
  
  .qr-code { top: 70.9%; left: 73.37%; width: 220px; height: 220px; padding: 10px; border: 2px solid #000; }
`}} />

    </PageTransition>
  );
}