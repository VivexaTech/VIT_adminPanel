import { db } from "./firebase";
import { doc, runTransaction } from "firebase/firestore";

/**
 * Safely generates an auto-incremented Certificate ID for the current year.
 * Format: VIT-[YEAR]-[XXX]
 */
export const generateCertificateId = async (): Promise<string> => {
  const currentYear = new Date().getFullYear().toString();
  const counterRef = doc(db, "metadata", `cert_counter_${currentYear}`);

  try {
    const newCount = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      let count = 1;
      if (counterDoc.exists()) {
        count = (counterDoc.data().count || 0) + 1;
      }

      transaction.set(counterRef, { count }, { merge: true });
      return count;
    });

    const formattedNumber = newCount.toString().padStart(3, "0");
    return `VIT-${currentYear}-${formattedNumber}`;
  } catch (error) {
    console.error("Error generating Certificate ID:", error);
    throw new Error("Failed to generate Certificate ID");
  }
};

/**
 * Safely generates an auto-incremented Receipt ID for the current year.
 * Format: VIT-REC-[YEAR]-[XXX]
 */
export const generateReceiptId = async (): Promise<string> => {
  const currentYear = new Date().getFullYear().toString();
  const counterRef = doc(db, "metadata", `receipt_counter_${currentYear}`);

  try {
    const newCount = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      let count = 1;
      if (counterDoc.exists()) {
        count = (counterDoc.data().count || 0) + 1;
      }

      transaction.set(counterRef, { count }, { merge: true });
      return count;
    });

    const formattedNumber = newCount.toString().padStart(3, "0");
    return `VIT-REC-${currentYear}-${formattedNumber}`;
  } catch (error) {
    console.error("Error generating Receipt ID:", error);
    throw new Error("Failed to generate Receipt ID");
  }
};

/**
 * Safely generates an auto-incremented Student ID.
 * Format: ST[XXX] (e.g., ST001, ST002)
 */
/**
 * Auto-incremented Course ID.
 * Format: VXC-001, VXC-002
 */
export const generateCourseId = async (): Promise<string> => {
  const counterRef = doc(db, "metadata", "global_course_counter");

  try {
    const newCount = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      let count = 1;
      if (counterDoc.exists()) {
        count = (counterDoc.data().count || 0) + 1;
      }
      transaction.set(counterRef, { count }, { merge: true });
      return count;
    });

    return `VXC-${newCount.toString().padStart(3, "0")}`;
  } catch (error) {
    console.error("Error generating Course ID:", error);
    throw new Error("Failed to generate Course ID");
  }
};

export const generateStudentId = async (): Promise<string> => {
  const counterRef = doc(db, "metadata", `global_student_counter`);

  try {
    const newCount = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      let count = 1;
      if (counterDoc.exists()) {
        count = (counterDoc.data().count || 0) + 1;
      }

      transaction.set(counterRef, { count }, { merge: true });
      return count;
    });

    const formattedNumber = newCount.toString().padStart(3, "0");
    return `ST${formattedNumber}`;
  } catch (error) {
    console.error("Error generating Student ID:", error);
    throw new Error("Failed to generate Student ID");
  }
};
