import type {
  InstituteTest,
  QuestionBankCsvRow,
  QuestionBankEntry,
  TestQuestion,
  TestQuestionCsvRow,
} from "@/types/test";
import {
  QUESTION_BANK_CSV_HEADERS,
  TEST_QUESTION_CSV_HEADERS,
} from "@/types/test";

export type CsvRowError = { row: number; testId?: string; questionId?: string; message: string };

export type CsvImportResult = {
  inserted: number;
  updated: number;
  skipped: number;
  testsCreated: number;
  testsUpdated: number;
  bankUpserted: number;
  errors: CsvRowError[];
};

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/\s+/g, "").trim();
}

const HEADER_ALIASES: Record<string, (typeof TEST_QUESTION_CSV_HEADERS)[number]> = {
  testid: "testId",
  testtitle: "testTitle",
  questionid: "questionId",
  question: "question",
  optiona: "optionA",
  optionb: "optionB",
  optionc: "optionC",
  optiond: "optionD",
  correctanswer: "correctAnswer",
  marks: "marks",
};

function mapHeaders(headerCells: string[]): (typeof TEST_QUESTION_CSV_HEADERS)[number][] | null {
  const mapped = headerCells.map((h) => HEADER_ALIASES[normalizeHeader(h)]);
  const expected = TEST_QUESTION_CSV_HEADERS as readonly string[];
  if (mapped.length !== expected.length || mapped.some((m) => !m)) return null;
  return mapped as (typeof TEST_QUESTION_CSV_HEADERS)[number][];
}

export function resolveCorrectAnswer(
  correct: string,
  options: [string, string, string, string]
): string | null {
  const trimmed = correct.trim();
  if (!trimmed) return null;

  const letterMap: Record<string, number> = { a: 0, b: 1, c: 2, d: 3 };
  const letter = trimmed.toLowerCase();
  if (letter.length === 1 && letterMap[letter] !== undefined) {
    const opt = options[letterMap[letter]]?.trim();
    return opt || null;
  }

  const exactIdx = options.findIndex((o) => o.trim() === trimmed);
  if (exactIdx >= 0) return options[exactIdx].trim();

  const ciIdx = options.findIndex((o) => o.trim().toLowerCase() === trimmed.toLowerCase());
  if (ciIdx >= 0) return options[ciIdx].trim();

  return null;
}

export function csvRowToQuestion(row: TestQuestionCsvRow): { question: TestQuestion } | { error: string } {
  const options: [string, string, string, string] = [
    row.optionA?.trim() || "",
    row.optionB?.trim() || "",
    row.optionC?.trim() || "",
    row.optionD?.trim() || "",
  ];

  if (!options.every(Boolean)) {
    return { error: "All four options (A–D) are required." };
  }

  const correctAnswer = resolveCorrectAnswer(row.correctAnswer, options);
  if (!correctAnswer) {
    return { error: "Correct answer must match option A, B, C, D, or the exact option text." };
  }

  const marks = Number(row.marks);
  if (row.marks?.trim() && (Number.isNaN(marks) || marks <= 0)) {
    return { error: "Marks must be a positive number." };
  }

  return {
    question: {
      id: row.questionId.trim(),
      question: row.question.trim(),
      options: [...options],
      correctAnswer,
      marks: marks > 0 ? marks : 1,
    },
  };
}

export function parseTestQuestionsCsv(text: string): {
  rows: { row: number; values: TestQuestionCsvRow }[];
  errors: CsvRowError[];
} {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim());
  const errors: CsvRowError[] = [];
  const rows: { row: number; values: TestQuestionCsvRow }[] = [];

  if (!lines.length) {
    return { rows, errors: [{ row: 0, message: "CSV file is empty." }] };
  }

  const headerCells = parseCsvLine(lines[0]);
  const fieldOrder = mapHeaders(headerCells);

  if (!fieldOrder) {
    return {
      rows,
      errors: [
        {
          row: 1,
          message: `Invalid header. Expected: ${TEST_QUESTION_CSV_HEADERS.join(", ")}`,
        },
      ],
    };
  }

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    if (cells.every((c) => !c)) continue;

    const values = {} as TestQuestionCsvRow;
    fieldOrder.forEach((field, idx) => {
      values[field] = cells[idx] ?? "";
    });

    const rowNum = i + 1;
    const testId = values.testId?.trim();
    const testTitle = values.testTitle?.trim();
    const questionId = values.questionId?.trim();

    if (!testId) {
      errors.push({ row: rowNum, message: "Test ID is required." });
      continue;
    }
    if (!testTitle) {
      errors.push({ row: rowNum, testId, message: "Test Title is required." });
      continue;
    }
    if (!questionId) {
      errors.push({ row: rowNum, testId, message: "Question ID is required." });
      continue;
    }
    if (!values.question?.trim()) {
      errors.push({ row: rowNum, testId, questionId, message: "Question text is required." });
      continue;
    }

    const converted = csvRowToQuestion(values);
    if ("error" in converted) {
      errors.push({ row: rowNum, testId, questionId, message: converted.error });
      continue;
    }

    rows.push({ row: rowNum, values });
  }

  return { rows, errors };
}

export function questionToCsvRow(
  testId: string,
  testTitle: string,
  q: TestQuestion
): TestQuestionCsvRow {
  const opts = q.options.length >= 4 ? q.options : [...q.options, "", "", "", ""].slice(0, 4);
  return {
    testId,
    testTitle,
    questionId: q.id,
    question: q.question,
    optionA: opts[0] || "",
    optionB: opts[1] || "",
    optionC: opts[2] || "",
    optionD: opts[3] || "",
    correctAnswer: q.correctAnswer,
    marks: String(q.marks ?? 1),
  };
}

export function testQuestionsToCsv(test: InstituteTest): string {
  const testId = test.testId || test.id;
  const testTitle = test.title || "";
  const header = TEST_QUESTION_CSV_HEADERS.join(",");
  const questions = test.questions ?? [];
  const dataRows = questions.map((q) => {
    const row = questionToCsvRow(testId, testTitle, q);
    return TEST_QUESTION_CSV_HEADERS.map((h) => escapeCsv(row[h] ?? "")).join(",");
  });
  return [header, ...dataRows].join("\n");
}

export function allTestsQuestionsToCsv(tests: InstituteTest[]): string {
  const header = TEST_QUESTION_CSV_HEADERS.join(",");
  const dataRows: string[] = [];
  for (const test of tests) {
    const testId = test.testId || test.id;
    const testTitle = test.title || "";
    for (const q of test.questions ?? []) {
      const row = questionToCsvRow(testId, testTitle, q);
      dataRows.push(TEST_QUESTION_CSV_HEADERS.map((h) => escapeCsv(row[h] ?? "")).join(","));
    }
  }
  return [header, ...dataRows].join("\n");
}

export function questionBankToCsv(entries: QuestionBankEntry[]): string {
  const header = QUESTION_BANK_CSV_HEADERS.join(",");
  const dataRows = entries.map((e) => {
    const opts = e.options.length >= 4 ? e.options : [...e.options, "", "", "", ""].slice(0, 4);
    const row: QuestionBankCsvRow = {
      questionId: e.questionId,
      question: e.question,
      optionA: opts[0] || "",
      optionB: opts[1] || "",
      optionC: opts[2] || "",
      optionD: opts[3] || "",
      correctAnswer: e.correctAnswer,
      marks: String(e.marks),
      subject: e.subject || "",
      courseId: e.courseId || "",
    };
    return QUESTION_BANK_CSV_HEADERS.map((h) => escapeCsv(row[h] ?? "")).join(",");
  });
  return [header, ...dataRows].join("\n");
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function getSampleQuestionsCsv(): string {
  return (
    TEST_QUESTION_CSV_HEADERS.join(",") +
    "\nVT-001,Java Basics Quiz,Q1,What is JVM?,Java Virtual Machine,Java Visual Machine,Java Vendor Machine,Just Virtual Machine,A,2" +
    "\nVT-001,Java Basics Quiz,Q2,Which is OOP principle?,Encapsulation,Compilation,Execution,Installation,A,2"
  );
}

/** @deprecated Use testQuestionsToCsv / allTestsQuestionsToCsv */
export function testsToCsv(tests: InstituteTest[]): string {
  return allTestsQuestionsToCsv(tests);
}

/** @deprecated Use parseTestQuestionsCsv */
export function parseTestsCsv(text: string) {
  return parseTestQuestionsCsv(text);
}
