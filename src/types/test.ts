export type TestQuestion = {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  marks?: number;
};

export type InstituteTest = {
  id: string;
  testId: string;
  title: string;
  description?: string;
  courseId?: string;
  course?: string;
  batchId?: string;
  subject?: string;
  totalMarks?: number;
  passingMarks?: number;
  duration?: number;
  type?: string;
  status?: string;
  questions?: TestQuestion[];
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type TestAssignType = "student" | "students" | "batch" | "course";

export type TestAssignmentRecord = {
  id: string;
  testId: string;
  title: string;
  courseId?: string;
  batchId?: string;
  assignType: TestAssignType;
  studentIds: string[];
  batchIds?: string[];
  courseIds?: string[];
  dueDate?: string;
  createdAt?: unknown;
};

export type TestAttemptRecord = {
  id: string;
  testId: string;
  studentId: string;
  studentName?: string;
  title?: string;
  score: number;
  maxScore: number;
  passingMarks?: number;
  passed: boolean;
  status: "attempted" | "pending";
  submittedAt?: string;
};

/** One row per question — primary import/export format */
export const TEST_QUESTION_CSV_HEADERS = [
  "testId",
  "testTitle",
  "questionId",
  "question",
  "optionA",
  "optionB",
  "optionC",
  "optionD",
  "correctAnswer",
  "marks",
] as const;

export type TestQuestionCsvRow = Record<(typeof TEST_QUESTION_CSV_HEADERS)[number], string>;

/** Question bank document (reusable across tests) */
export const QUESTION_BANK_CSV_HEADERS = [
  "questionId",
  "question",
  "optionA",
  "optionB",
  "optionC",
  "optionD",
  "correctAnswer",
  "marks",
  "subject",
  "courseId",
] as const;

export type QuestionBankCsvRow = Record<(typeof QUESTION_BANK_CSV_HEADERS)[number], string>;

export type QuestionBankEntry = {
  id: string;
  questionId: string;
  question: string;
  options: string[];
  correctAnswer: string;
  marks: number;
  subject?: string;
  courseId?: string;
  usedInTests?: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
};

/** @deprecated Legacy whole-test CSV — kept for reference */
export const TEST_CSV_HEADERS = [
  "testId",
  "testName",
  "courseId",
  "subject",
  "totalMarks",
  "duration",
  "questions",
  "options",
  "correctAnswers",
] as const;

export type TestCsvRow = Record<(typeof TEST_CSV_HEADERS)[number], string>;
