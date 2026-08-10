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
  try {
    const count = await db.runTransaction(async (tx) => {
      const snap = await tx.get(counterRef);
      const next = (snap.exists ? snap.data()?.count || 0 : 0) + 1;
      tx.set(counterRef, { count: next, year: Number(year) }, { merge: true });
      return next;
    });
    return `VIT-REC-${year}-${count.toString().padStart(3, "0")}`;
  } catch (err) {
    console.error("Server receipt counter failed, using fallback:", err);
    return `VIT-REC-${year}-${Date.now().toString().slice(-6)}`;
  }
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
      courseId: bodyCourseId,
      courseTitle: bodyCourseTitle,
      courses: bodyCourses,
      courseDisplayName,
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
      discountIds = [],
      manualDiscount = 0,
      discountBreakdown,
      admissionFeePaid = 0,
      paymentMethod = "Cash",
      notes,
      inquiryId,
      studentPhotoUrl = "",
      aadhaarUrl = "",
    } = body;

    const parent = parentName || fatherName || "";
    const personalEmail = email?.trim().toLowerCase();

    type CourseItem = { courseId: string; courseTitle: string; batch?: string; batchId?: string };
    const courseList: CourseItem[] = Array.isArray(bodyCourses) && bodyCourses.length > 0
      ? bodyCourses
          .filter((c: CourseItem) => c?.courseId && c?.courseTitle)
          .map((c: CourseItem) => ({
            courseId: String(c.courseId),
            courseTitle: String(c.courseTitle).trim(),
            batch: c.batch ? String(c.batch) : undefined,
            batchId: c.batchId ? String(c.batchId) : undefined,
          }))
      : bodyCourseId && bodyCourseTitle
        ? [{
            courseId: String(bodyCourseId),
            courseTitle: String(bodyCourseTitle).trim(),
            batch: batch ? String(batch) : undefined,
            batchId: batchId ? String(batchId) : undefined,
          }]
        : [];

    if (!fullName?.trim() || !personalEmail || !phone?.trim() || courseList.length === 0) {
      return NextResponse.json({ error: "Name, personal email, phone, and at least one course are required." }, { status: 400 });
    }

    const courseTitles = courseList.map((c) => c.courseTitle);
    const displayName =
      (typeof courseDisplayName === "string" && courseDisplayName.trim()) ||
      (courseTitles.length > 1
        ? courseTitles.join(" with ")
        : courseTitles[0]);
    const primary = courseList[0];
    const courseId = primary.courseId;
    const course = displayName;

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

    const enrollments = await Promise.all(
      courseList.map(async (item) => {
        const courseSnap = await db.collection("courses").doc(item.courseId).get();
        const instructorName = courseSnap.exists
          ? courseSnap.data()?.instructorName || courseSnap.data()?.instructor?.name || "Vivexa Instructor"
          : "Vivexa Instructor";
        return buildEnrollment(
          item.courseId,
          item.courseTitle,
          instructorName,
          item.batch || batch || "",
          item.batchId || batchId
        );
      })
    );

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
      let existingCourses: EnrollmentEntry[] = data.enrolledCourses || [];
      for (const enrollment of enrollments) {
        const alreadyEnrolled = existingCourses.some((e) => e.courseId === enrollment.courseId);
        existingCourses = alreadyEnrolled
          ? existingCourses.map((e) => (e.courseId === enrollment.courseId ? { ...e, ...enrollment } : e))
          : [...existingCourses, enrollment];
        await studentDoc.ref.collection("enrollments").doc(enrollment.courseId).set(enrollment, { merge: true });
      }

      await studentDoc.ref.update({
        enrolledCourses: existingCourses,
        enrolledCourse: existingCourses[0] || null,
        course: displayName,
        courseDisplayName: displayName,
        courseId: existingCourses[0]?.courseId || courseId,
        batch: primary.batch?.trim() || batch?.trim() || data.batch || null,
        parentName: parent.trim() || data.parentName || null,
        personalEmail,
        stats: {
          ...(data.stats || {}),
          enrolled: existingCourses.length,
        },
        updatedAt: FieldValue.serverTimestamp(),
      });
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
          course: displayName,
          courseDisplayName: displayName,
          courseId,
          batch: primary.batch?.trim() || batch?.trim() || null,
          address: fullAddress,
          qualification: qualification?.trim() || "",
          joinDate,
          status: "Active",
          role: "student",
          enrolledCourses: enrollments,
          enrolledCourse: enrollments[0],
          stats: { enrolled: enrollments.length, completed: 0, certificates: 0, pendingFee: "₹0" },
          preferences: { inAppNotifications: true, emailAlerts: false },
          mustChangePassword: true,
          studentPhotoUrl: typeof studentPhotoUrl === "string" ? studentPhotoUrl : "",
          aadhaarUrl: typeof aadhaarUrl === "string" ? aadhaarUrl : "",
          createdAt: FieldValue.serverTimestamp(),
        });

      for (const enrollment of enrollments) {
        await db.collection("students").doc(studentId).collection("enrollments").doc(enrollment.courseId).set(enrollment);
      }
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
      courseDisplayName: displayName,
      courseId,
      courses: courseList.map((c) => ({
        courseId: c.courseId,
        courseTitle: c.courseTitle,
        batch: c.batch || null,
        batchId: c.batchId || null,
      })),
      batch: primary.batch?.trim() || batch?.trim() || null,
      qualification: qualification?.trim() || "",
      address: address?.trim() || "",
      city: city?.trim() || "",
      state: state?.trim() || "",
      admissionDate: admissionDate || new Date().toISOString().split("T")[0],
      courseDuration: courseDuration || "",
      notes: notes?.trim() || "",
      studentPhotoUrl: typeof studentPhotoUrl === "string" ? studentPhotoUrl : "",
      aadhaarUrl: typeof aadhaarUrl === "string" ? aadhaarUrl : "",
      discount: discountNum,
      discountIds: Array.isArray(discountIds) ? discountIds : [],
      manualDiscount: Number(manualDiscount) || 0,
      discountBreakdown: discountBreakdown || null,
      isNewStudent,
      inquiryId: typeof inquiryId === "string" && inquiryId.trim() ? inquiryId.trim() : null,
      createdAt: FieldValue.serverTimestamp(),
    });

    if (Array.isArray(discountIds) && discountIds.length > 0) {
      for (const did of discountIds) {
        if (typeof did !== "string" || !did.trim()) continue;
        try {
          await db.collection("discounts").doc(did.trim()).update({
            usedCount: FieldValue.increment(1),
            updatedAt: new Date().toISOString(),
          });
        } catch {
          /* discount doc may not exist */
        }
      }
    }

    if (typeof inquiryId === "string" && inquiryId.trim()) {
      await db.collection("institute_inquiries").doc(inquiryId.trim()).set(
        {
          status: "Admission Confirmed",
          admissionId: admissionRef.id,
          convertedAt: new Date().toISOString(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

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
        courses: courseTitles,
        totalFee: actualTotal,
        originalFee: totalFee,
        discount: discountNum,
        discountBreakdown: discountBreakdown || null,
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
      for (const title of courseTitles) {
        if (!courses.includes(title)) courses.push(title);
      }
      if (!courses.includes(displayName) && courseTitles.length > 1) {
        /* display name is aggregate — keep individual titles */
      }
      await feeRef.update({
        courses,
        course: displayName,
        totalFee: (existing.totalFee || 0) + actualTotal,
        paidAmount: (existing.paidAmount || 0) + paidAmount,
        remainingFee: (existing.remainingFee || 0) + remainingFee,
        discount: (existing.discount || 0) + discountNum,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    const batchIdsToAdd = [
      ...new Set(
        courseList
          .map((c) => c.batchId?.trim())
          .filter(Boolean)
          .concat(batchId?.trim() ? [batchId.trim()] : [])
      ),
    ] as string[];

    for (const bid of batchIdsToAdd) {
      const batchRef = db.collection("batches").doc(bid);
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
            paymentDate,
            studentName: fullName.trim(),
            studentId,
            mobile: phone.trim(),
            courseName: course,
            batchName: primary.batch?.trim() || batch?.trim() || "",
            feeType: "Admission Fee",
            paymentMode: paymentMethod,
            transactionRef: "",
            lineItems: [{ description: `Admission fee - ${course}`, amount: paidAmount }],
            originalFee:
              Number(feeAfter.originalFee) ||
              totalFee ||
              totalFeeForReceipt + (Number(feeAfter.discount) || discountNum),
            discount: Number(feeAfter.discount) || discountNum,
            discountNote:
              Array.isArray(discountIds) && discountIds.length
                ? `${discountIds.length} discount(s) applied`
                : undefined,
            totalFee: totalFeeForReceipt,
            previouslyPaid,
            currentPayment: paidAmount,
            remainingBalance: remainingForReceipt,
            logoUrl,
            authorizedSignatureUrl,
            instituteName:
              typeof settingsData.instituteName === "string" ? settingsData.instituteName : undefined,
            institutePhone: typeof settingsData.phone === "string" ? settingsData.phone : undefined,
            instituteEmail: typeof settingsData.email === "string" ? settingsData.email : undefined,
            instituteAddress:
              typeof settingsData.address === "string" ? settingsData.address : undefined,
          },
          { includePrintButton: false }
        );

        try {
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
        } catch (saveErr) {
          console.error("Failed to persist receipt doc (HTML still returned):", saveErr);
        }

        try {
          await db.collection("students").doc(studentId).collection("notifications").add({
            type: "fee_receipt",
            title: "Fee Receipt Generated",
            message: `Receipt ${receiptNo} for ₹${paidAmount.toLocaleString("en-IN")} has been issued.`,
            time: formatNotificationTime(),
            isRead: false,
            route: "/profile/fee",
            createdAt: FieldValue.serverTimestamp(),
          });
        } catch (notifErr) {
          console.error("Failed to add receipt notification:", notifErr);
        }

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
        // Keep any partial receiptHtml if build succeeded before a later failure
        if (!receiptHtml) {
          receiptNo = undefined;
          receiptHtml = undefined;
        }
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
