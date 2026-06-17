import { NextRequest, NextResponse } from "next/server";
import { verifyAdminNotTrainerRequest } from "@/lib/verifyAdminRequest";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { generateSecurePassword } from "@/lib/passwordUtils";
import { logServerAudit } from "@/lib/serverAudit";

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
      rollNumber,
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
    const emailLower = email?.trim().toLowerCase();

    if (!fullName?.trim() || !emailLower || !phone?.trim() || !course || !courseId) {
      return NextResponse.json({ error: "Name, email, phone, and course are required." }, { status: 400 });
    }

    const db = getAdminDb();
    const auth = getAdminAuth();

    const courseSnap = await db.collection("courses").doc(courseId).get();
    const instructorName =
      courseSnap.exists ? courseSnap.data()?.instructorName || courseSnap.data()?.instructor?.name || "Vivexa Instructor" : "Vivexa Instructor";

    const enrollment = buildEnrollment(courseId, course, instructorName, batch, batchId);

    const emailQuery = await db.collection("students").where("email", "==", emailLower).limit(1).get();
    const isExisting = !emailQuery.empty;

    let studentId: string;
    let uid: string;
    let isNewStudent = false;
    let createdStudentPassword = "";

    if (isExisting) {
      const studentDoc = emailQuery.docs[0];
      studentId = studentDoc.id;
      const data = studentDoc.data();
      uid = data.uid;

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
        rollNumber: rollNumber?.trim() || data.rollNumber || null,
        parentName: parent.trim() || data.parentName || null,
        stats: {
          ...(data.stats || {}),
          enrolled: updatedCourses.length,
        },
        updatedAt: FieldValue.serverTimestamp(),
      });

      await studentDoc.ref.collection("enrollments").doc(courseId).set(enrollment, { merge: true });
    } else {
      createdStudentPassword = password?.trim() || generateSecurePassword(10);
      if (createdStudentPassword.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
      }

      isNewStudent = true;
      const counterRef = db.collection("metadata").doc("global_student_counter");
      studentId = await db.runTransaction(async (tx) => {
        const snap = await tx.get(counterRef);
        const count = (snap.exists ? snap.data()?.count || 0 : 0) + 1;
        tx.set(counterRef, { count }, { merge: true });
        return `ST${String(count).padStart(3, "0")}`;
      });

      const userRecord = await auth.createUser({
        email: emailLower,
        password: createdStudentPassword,
        displayName: fullName.trim(),
      });
      uid = userRecord.uid;

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
          email: emailLower,
          phone: phone.trim(),
          course,
          courseId,
          batch: batch?.trim() || null,
          rollNumber: rollNumber?.trim() || null,
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

    const totalFee = Number(totalCourseFee) || 0;
    const paidAmount = Number(admissionFeePaid) || 0;
    const discountNum = Number(discount) || 0;
    const actualTotal = totalFee - discountNum;
    const remainingFee = Math.max(0, actualTotal - paidAmount);
    let paymentStatus = "Pending";
    if (remainingFee <= 0) paymentStatus = "Paid";
    else if (paidAmount > 0) paymentStatus = "Partial";

    const admissionRef = db.collection("admissions").doc();
    await admissionRef.set({
      studentId,
      fullName: fullName.trim(),
      parentName: parent.trim() || null,
      fatherName: parent.trim() || null,
      email: emailLower,
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

    if (isNewStudent && createdStudentPassword.length > 0) {
      await logServerAudit(performer, "student_account_created", {
        targetUserId: studentId,
        targetEmail: emailLower,
        details: `Admission for ${course}`,
      });
      return NextResponse.json({
        success: true,
        studentId,
        isNewStudent: true,
        email: emailLower,
        temporaryPassword: createdStudentPassword,
        mustChangePassword: true,
        message: `Student account created (${studentId}). Share login credentials securely.`,
      });
    }

    return NextResponse.json({
      success: true,
      studentId,
      isNewStudent: false,
      message: `Course "${course}" added to existing student ${studentId}.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Admission failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
