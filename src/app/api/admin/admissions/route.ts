import { NextRequest, NextResponse } from "next/server";
import { verifyAdminNotTrainerRequest } from "@/lib/verifyAdminRequest";
import { getAdminAuth, getAdminDb, isAdminConfigured } from "@/lib/firebaseAdmin";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { generateSecurePassword } from "@/lib/passwordUtils";
import { logServerAudit } from "@/lib/serverAudit";
import { validateFeePayment, getRemainingFee, getPayableFee } from "@/lib/feeValidation";
import {
  formatStudentId,
  buildStudentLoginEmail,
  generateSixDigitPassword,
} from "@/lib/studentIdUtils";
import { sendStudentCredentialsEmail, sendFeeReceiptEmail, isEmailConfigured } from "@/lib/emailService";
import { buildReceiptHtml } from "@/lib/receiptTemplate";

export const runtime = "nodejs";

function formatNotificationTime(date = new Date()): string {
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function generateReceiptNoServer(db: Firestore): Promise<string> {
  const year = new Date().getFullYear().toString();
  const counterRef = db.collection("metadata").doc(`receipt_counter_${year}`);
  const count = await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const next = (snap.exists ? snap.data()?.count || 0 : 0) + 1;
    tx.set(counterRef, { count: next, year: Number(year) }, { merge: true });
    return next;
  });
  return `VIT-REC-${year}-${count.toString().padStart(3, "0")}`;
}

function buildEnrollment(
  courseId: string,
  title: string,
  instructor: string,
  batch: string,
  batchId?: string
) {
  return {
    courseId,
    title,
    instructor: instructor || "Vivexa Instructor",
    batch: batch || null,
    batchId: batchId || null,
    progress: 0,
    totalClasses: 0,
    completedClasses: 0,
    attendancePercentage: 0,
    isLiveNow: false,
    liveTopic: "",
    enrolledAt: new Date().toISOString(),
  };
}

export async function POST(request: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      {
        error:
          "Server configuration error: Firebase Admin SDK is not set up. Add FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY to your environment.",
      },
      { status: 503 }
    );
  }

  let createdAuthUid: string | null = null;

  try {
    const performer = await verifyAdminNotTrainerRequest(request);
    const body = await request.json();

    const {
      fullName,
      parentName,
      fatherName,
      email,
      phone,
      password,
      courseId,
      courseTitle,
      batch,
      batchId,
      qualification,
      address,
      city,
      state,
      admissionDate,
      courseDuration,
      nextDueDate,
      totalCourseFee,
      discount = 0,
      admissionFeePaid = 0,
      paymentMethod = "Cash",
      notes,
    } = body;

    const parent = parentName || fatherName || "";
    const course = courseTitle?.trim();
    const personalEmail = email?.trim().toLowerCase();

    if (!fullName?.trim() || !personalEmail || !phone?.trim() || !course || !courseId) {
      return NextResponse.json({ error: "Name, personal email, phone, and course are required." }, { status: 400 });
    }

    const totalFee = Number(totalCourseFee) || 0;
    const paidAmount = Number(admissionFeePaid) || 0;
    const discountNum = Number(discount) || 0;
    const feeError = validateFeePayment({ totalFee, discount: discountNum, paidAmount });
    if (feeError) {
      return NextResponse.json({ error: feeError }, { status: 400 });
    }

    const actualTotal = getPayableFee(totalFee, discountNum);
    const remainingFee = getRemainingFee(totalFee, discountNum, paidAmount);

    const db = getAdminDb();
    const auth = getAdminAuth();

    const courseSnap = await db.collection("courses").doc(courseId).get();
    const instructorName =
      courseSnap.exists ? courseSnap.data()?.instructorName || courseSnap.data()?.instructor?.name || "Vivexa Instructor" : "Vivexa Instructor";

    const enrollment = buildEnrollment(courseId, course, instructorName, batch, batchId);

    const emailQuery = await db.collection("students").where("personalEmail", "==", personalEmail).limit(1).get();
    const loginEmailQuery = emailQuery.empty
      ? await db.collection("students").where("email", "==", personalEmail).limit(1).get()
      : emailQuery;
    const isExisting = !loginEmailQuery.empty;

    let studentId: string;
    let uid: string;
    let isNewStudent = false;
    let createdStudentPassword = "";

    let loginEmail = "";

    if (isExisting) {
      const studentDoc = loginEmailQuery.docs[0];
      studentId = studentDoc.id;
      const data = studentDoc.data();
      uid = data.uid;
      loginEmail = data.email || buildStudentLoginEmail(studentId);

      if (!uid) {
        return NextResponse.json(
          { error: "Student exists but has no login account. Contact support to link Firebase Auth." },
          { status: 400 }
        );
      }

      type EnrollmentEntry = ReturnType<typeof buildEnrollment>;
      const existingCourses: EnrollmentEntry[] = data.enrolledCourses || [];
      const alreadyEnrolled = existingCourses.some((e) => e.courseId === courseId);

      const updatedCourses: EnrollmentEntry[] = alreadyEnrolled
        ? existingCourses.map((e) => (e.courseId === courseId ? { ...e, ...enrollment } : e))
        : [...existingCourses, enrollment];

      await studentDoc.ref.update({
        enrolledCourses: updatedCourses,
        enrolledCourse: updatedCourses[0] || null,
        course: updatedCourses.map((c) => c.title).join(", "),
        batch: batch?.trim() || data.batch || null,
        parentName: parent.trim() || data.parentName || null,
        personalEmail,
        stats: {
          ...(data.stats || {}),
          enrolled: updatedCourses.length,
        },
        updatedAt: FieldValue.serverTimestamp(),
      });

      await studentDoc.ref.collection("enrollments").doc(courseId).set(enrollment, { merge: true });
    } else {
      createdStudentPassword = password?.trim() || generateSixDigitPassword();
      if (!/^\d{6}$/.test(createdStudentPassword) && createdStudentPassword.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters or a 6-digit code." }, { status: 400 });
      }

      isNewStudent = true;
      const year = new Date().getFullYear();
      const counterRef = db.collection("metadata").doc(`student_counter_${year}`);
      studentId = await db.runTransaction(async (tx) => {
        const snap = await tx.get(counterRef);
        const count = (snap.exists ? snap.data()?.count || 0 : 0) + 1;
        tx.set(counterRef, { count, year }, { merge: true });
        return formatStudentId(count, year);
      });

      loginEmail = buildStudentLoginEmail(studentId);

      const userRecord = await auth.createUser({
        email: loginEmail,
        password: createdStudentPassword,
        displayName: fullName.trim(),
      });
      uid = userRecord.uid;
      createdAuthUid = uid;

      const fullAddress = [address, city, state].filter(Boolean).join(", ");
      const joinDate =
        admissionDate ||
        new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

      await db
        .collection("students")
        .doc(studentId)
        .set({
          uid,
          studentId,
          fullName: fullName.trim(),
          parentName: parent.trim() || null,
          email: loginEmail,
          personalEmail,
          phone: phone.trim(),
          course,
          courseId,
          batch: batch?.trim() || null,
          address: fullAddress,
          qualification: qualification?.trim() || "",
          joinDate,
          status: "Active",
          role: "student",
          enrolledCourses: [enrollment],
          enrolledCourse: enrollment,
          stats: { enrolled: 1, completed: 0, certificates: 0, pendingFee: "₹0" },
          preferences: { inAppNotifications: true, emailAlerts: false },
          mustChangePassword: true,
          createdAt: FieldValue.serverTimestamp(),
        });

      await db.collection("students").doc(studentId).collection("enrollments").doc(courseId).set(enrollment);
    }

    let paymentStatus = "Pending";
    if (remainingFee <= 0) paymentStatus = "Paid";
    else if (paidAmount > 0) paymentStatus = "Partial";

    const admissionRef = db.collection("admissions").doc();
    await admissionRef.set({
      studentId,
      fullName: fullName.trim(),
      parentName: parent.trim() || null,
      fatherName: parent.trim() || null,
      email: loginEmail,
      personalEmail,
      phone: phone.trim(),
      course,
      courseId,
      batch: batch?.trim() || null,
      qualification: qualification?.trim() || "",
      address: address?.trim() || "",
      city: city?.trim() || "",
      state: state?.trim() || "",
      admissionDate: admissionDate || new Date().toISOString().split("T")[0],
      courseDuration: courseDuration || "",
      notes: notes?.trim() || "",
      isNewStudent,
      createdAt: FieldValue.serverTimestamp(),
    });

    const feeRef = db.collection("student_fees").doc(studentId);
    const feeSnap = await feeRef.get();

    if (!feeSnap.exists) {
      const installments =
        paidAmount > 0
          ? [
              {
                amount: paidAmount,
                method: paymentMethod,
                transactionId: "Admission",
                date: admissionDate || new Date().toISOString().split("T")[0],
                note: `Admission fee - ${course}`,
              },
            ]
          : [];

      const newFeeData = {
        studentId,
        studentName: fullName.trim(),
        course,
        courses: [course],
        totalFee: actualTotal,
        originalFee: totalFee,
        discount: discountNum,
        paidAmount,
        remainingFee,
        paymentStatus,
        admissionDate: admissionDate || new Date().toISOString().split("T")[0],
        nextDueDate: nextDueDate || "",
        installments,
        createdAt: FieldValue.serverTimestamp(),
      };
      await feeRef.set(newFeeData);
      await db.collection("students").doc(studentId).collection("fees").doc("current").set(
        {
          totalFee: actualTotal,
          paidAmount,
          dueAmount: remainingFee,
          remainingFee,
          dueDate: nextDueDate || "",
          nextDueDate: nextDueDate || "",
          paymentStatus,
          transactions: installments.map((inst, i) => ({
            id: inst.transactionId || `TXN-${i + 1}`,
            date: inst.date,
            amount: inst.amount,
            status: "Paid",
            method: inst.method,
          })),
          syncedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      await db.collection("students").doc(studentId).update({
        "stats.pendingFee": `₹${Math.max(0, remainingFee).toLocaleString("en-IN")}`,
      });
    } else {
      const existing = feeSnap.data()!;
      const courses: string[] = existing.courses || [existing.course].filter(Boolean);
      if (!courses.includes(course)) courses.push(course);
      await feeRef.update({
        courses,
        course: courses.join(", "),
        totalFee: (existing.totalFee || 0) + actualTotal,
        paidAmount: (existing.paidAmount || 0) + paidAmount,
        remainingFee: (existing.remainingFee || 0) + remainingFee,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    if (batchId?.trim()) {
      const batchRef = db.collection("batches").doc(batchId.trim());
      const batchSnap = await batchRef.get();
      if (batchSnap.exists) {
        const ids: string[] = batchSnap.data()?.studentIds || [];
        if (!ids.includes(studentId)) {
          await batchRef.update({
            studentIds: [...ids, studentId],
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }
    }

    let receiptNo: string | undefined;
    let receiptHtml: string | undefined;

    if (paidAmount > 0) {
      try {
        const settingsSnap = await db.collection("appConfig").doc("institute").get();
        const settingsData = settingsSnap.exists ? settingsSnap.data() || {} : {};
        const logoUrl =
          typeof settingsData.logoUrl === "string" ? settingsData.logoUrl : undefined;
        const authorizedSignatureUrl =
          typeof settingsData.authorizedSignatureUrl === "string"
            ? settingsData.authorizedSignatureUrl
            : undefined;

        const feeAfterSnap = await feeRef.get();
        const feeAfter = feeAfterSnap.exists ? feeAfterSnap.data() || {} : {};
        const totalFeeForReceipt = Number(feeAfter.totalFee) || actualTotal;
        const remainingForReceipt = Number(feeAfter.remainingFee) || remainingFee;
        const previouslyPaid = Math.max(0, (Number(feeAfter.paidAmount) || paidAmount) - paidAmount);
        const paymentDate = admissionDate || new Date().toISOString().split("T")[0];

        receiptNo = await generateReceiptNoServer(db);
        receiptHtml = buildReceiptHtml(
          {
            receiptNo,
            date: paymentDate,
            studentName: fullName.trim(),
            studentId,
            mobile: phone.trim(),
            courseName: course,
            paymentMode: paymentMethod,
            lineItems: [{ description: `Admission fee - ${course}`, amount: paidAmount }],
            totalFee: totalFeeForReceipt,
            previouslyPaid,
            currentPayment: paidAmount,
            remainingBalance: remainingForReceipt,
            logoUrl,
            authorizedSignatureUrl,
          },
          { includePrintButton: true }
        );

        await db.collection("receipts").doc(receiptNo).set({
          receiptNo,
          studentId,
          studentName: fullName.trim(),
          amount: paidAmount,
          course,
          remainingAmount: remainingForReceipt,
          paymentMode: paymentMethod,
          receiptHtml,
          createdAt: FieldValue.serverTimestamp(),
        });

        await db.collection("students").doc(studentId).collection("notifications").add({
          type: "fee_receipt",
          title: "Fee Receipt Generated",
          message: `Receipt ${receiptNo} for ₹${paidAmount.toLocaleString("en-IN")} has been issued.`,
          time: formatNotificationTime(),
          isRead: false,
          route: "/profile/fee",
          createdAt: FieldValue.serverTimestamp(),
        });

        if (isEmailConfigured()) {
          try {
            await sendFeeReceiptEmail({
              to: personalEmail,
              studentName: fullName.trim(),
              receiptHtml,
              receiptNo,
            });
          } catch (receiptEmailErr) {
            console.error("Failed to email admission fee receipt:", receiptEmailErr);
          }
        }
      } catch (receiptErr) {
        console.error("Admission fee receipt generation failed:", receiptErr);
        receiptNo = undefined;
        receiptHtml = undefined;
      }
    }

    if (isNewStudent && createdStudentPassword.length > 0) {
      await logServerAudit(performer, "student_account_created", {
        targetUserId: studentId,
        targetEmail: loginEmail,
        details: `Admission for ${course}`,
      });

      if (isEmailConfigured()) {
        try {
          await sendStudentCredentialsEmail({
            to: personalEmail,
            studentName: fullName.trim(),
            studentId,
            loginEmail,
            password: createdStudentPassword,
            course,
            batch: batch?.trim(),
          });
        } catch (emailErr) {
          console.error("Failed to email student credentials:", emailErr);
        }
      }

      return NextResponse.json({
        success: true,
        studentId,
        isNewStudent: true,
        loginEmail,
        personalEmail,
        temporaryPassword: createdStudentPassword,
        mustChangePassword: true,
        receiptNo: receiptNo || null,
        receiptHtml: receiptHtml || null,
        message: `Student account created (${studentId}). Credentials sent to ${personalEmail}.`,
      });
    }

    return NextResponse.json({
      success: true,
      studentId,
      isNewStudent: false,
      receiptNo: receiptNo || null,
      receiptHtml: receiptHtml || null,
      message: `Course "${course}" added to existing student ${studentId}.`,
    });
  } catch (error) {
    if (createdAuthUid) {
      try {
        await getAdminAuth().deleteUser(createdAuthUid);
      } catch {
        // best-effort rollback
      }
    }

    const message = error instanceof Error ? error.message : "Admission failed";
    const status =
      message === "Unauthorized" || message === "Forbidden" || message.includes("Forbidden")
        ? 403
        : message.includes("email-already-exists") || message.includes("already in use")
          ? 409
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
