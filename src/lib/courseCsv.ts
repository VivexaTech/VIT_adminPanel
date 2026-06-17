import type { Course } from "@/types/course";
import { CSV_HEADERS } from "@/types/course";
import type { CourseFormValues } from "@/types/course";

export type CsvRowError = { row: number; courseId?: string; message: string };

export type CsvImportResult = {
  inserted: number;
  updated: number;
  skipped: number;
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

export function coursesToCsv(courses: Course[]): string {
  const header = CSV_HEADERS.join(",");
  const rows = courses.map((c) => {
    const hasDiscount = Boolean(c.originalPrice);
    const values: Record<string, string> = {
      courseId: c.courseId || c.id,
      title: c.title,
      subtitle: c.subtitle ?? "",
      description: c.description,
      category: c.category,
      imageUrl: c.imageUrl,
      bannerUrl: c.bannerUrl ?? "",
      duration: c.duration,
      price: hasDiscount ? c.originalPrice! : c.price,
      discountPrice: hasDiscount ? c.price : "",
      level: c.level,
      instructorName: c.instructorName ?? "",
      features: (c.features ?? []).join("|"),
      curriculum: (c.curriculum ?? []).join("|"),
      liveClasses: String(c.liveClasses ?? 0),
      certificate: c.certificate ? "yes" : "no",
      status: c.status ?? "active",
      featured: c.featured ? "yes" : "no",
    };
    return CSV_HEADERS.map((h) => escapeCsv(values[h] ?? "")).join(",");
  });
  return [header, ...rows].join("\n");
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

function rowToFormValues(
  row: Record<string, string>,
  rowNum: number
): { values?: CourseFormValues; error?: string } {
  const courseId = row.courseid?.trim() || row.courseId?.trim();
  const title = row.title?.trim();

  if (!courseId) return { error: "courseId is required" };
  if (!/^[A-Za-z0-9_-]+$/.test(courseId)) {
    return { error: "courseId must be alphanumeric (dashes/underscores allowed)" };
  }
  if (!title || title.length < 3) return { error: "title must be at least 3 characters" };
  if (!row.description?.trim() || row.description.trim().length < 20) {
    return { error: "description must be at least 20 characters" };
  }
  if (!row.category?.trim()) return { error: "category is required" };
  if (!row.imageurl?.trim() && !row.imageUrl?.trim()) {
    return { error: "imageUrl is required" };
  }
  if (!row.duration?.trim()) return { error: "duration is required" };
  if (!row.price?.trim() || isNaN(Number(row.price))) return { error: "invalid price" };
  if (row.discountprice?.trim() && isNaN(Number(row.discountprice || row.discountPrice))) {
    return { error: "invalid discountPrice" };
  }
  if (!row.instructorname?.trim() && !row.instructorName?.trim()) {
    return { error: "instructorName is required" };
  }

  const level = (row.level?.trim() || "Beginner") as CourseFormValues["level"];
  if (!["Beginner", "Intermediate", "Advanced"].includes(level)) {
    return { error: "level must be Beginner, Intermediate, or Advanced" };
  }

  const status = (row.status?.trim().toLowerCase() || "active") as CourseFormValues["status"];
  if (status !== "active" && status !== "inactive") {
    return { error: "status must be active or inactive" };
  }

  const featuresRaw = row.features ?? "";
  const curriculumRaw = row.curriculum ?? "";
  const features = featuresRaw.split("|").map((f) => f.trim()).filter(Boolean);
  const curriculum = curriculumRaw.split("|").map((c) => c.trim()).filter(Boolean);

  if (!curriculum.length) return { error: "at least one curriculum item required" };

  const certRaw = (row.certificate ?? "yes").toLowerCase();
  const featRaw = (row.featured ?? "no").toLowerCase();

  return {
    values: {
      courseId,
      title,
      subtitle: row.subtitle?.trim() ?? "",
      description: row.description.trim(),
      category: row.category.trim(),
      imageUrl: (row.imageurl || row.imageUrl).trim(),
      bannerUrl: (row.bannerurl || row.bannerUrl || "").trim(),
      duration: row.duration.trim(),
      price: row.price.trim(),
      discountPrice: (row.discountprice || row.discountPrice || "").trim(),
      level,
      instructorName: (row.instructorname || row.instructorName).trim(),
      features: features.length ? features : [""],
      curriculum,
      liveClasses: row.liveclasses || row.liveClasses || "0",
      certificate: certRaw === "yes" || certRaw === "true" || certRaw === "1",
      status,
      featured: featRaw === "yes" || featRaw === "true" || featRaw === "1",
    },
  };
}

export function parseCoursesCsv(text: string): {
  rows: { rowNum: number; courseId: string; values: CourseFormValues }[];
  errors: CsvRowError[];
} {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim());
  if (lines.length < 2) {
    return { rows: [], errors: [{ row: 1, message: "CSV must include a header row and at least one data row" }] };
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const required = ["courseid", "title", "description", "category", "imageurl", "duration", "price", "instructorname", "curriculum"];
  const missing = required.filter((r) => !headers.includes(r));
  if (missing.length) {
    return {
      rows: [],
      errors: [{ row: 1, message: `Missing required columns: ${missing.join(", ")}` }],
    };
  }

  const rows: { rowNum: number; courseId: string; values: CourseFormValues }[] = [];
  const errors: CsvRowError[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => {
      record[h] = cols[idx] ?? "";
    });

    const { values, error } = rowToFormValues(record, i + 1);
    if (error || !values) {
      errors.push({
        row: i + 1,
        courseId: record.courseid || record.courseId,
        message: error ?? "Invalid row",
      });
    } else {
      rows.push({ rowNum: i + 1, courseId: values.courseId, values });
    }
  }

  return { rows, errors };
}
