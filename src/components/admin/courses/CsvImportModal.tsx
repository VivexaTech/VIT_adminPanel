"use client";



import { useRef, useState } from "react";

import { Upload, Loader2, Download } from "lucide-react";

import AdminModal from "@/components/ui/AdminModal";

import { parseCoursesCsv, type CsvRowError } from "@/lib/courseCsv";

import { importCoursesFromCsv } from "@/lib/courseService";

import { CSV_HEADERS } from "@/types/course";

import { btnSecondaryBlock } from "@/lib/theme";



type Props = {

  open: boolean;

  onClose: () => void;

  onComplete: (result: { inserted: number; updated: number; skipped: number; errors: CsvRowError[] }) => void;

};



export default function CsvImportModal({ open, onClose, onComplete }: Props) {

  const inputRef = useRef<HTMLInputElement>(null);

  const [importing, setImporting] = useState(false);

  const [progress, setProgress] = useState(0);

  const [parseErrors, setParseErrors] = useState<CsvRowError[]>([]);

  const [fileName, setFileName] = useState("");



  const sampleCsv =

    CSV_HEADERS.join(",") +

    "\nVXC-001,Sample Course,,A detailed course description here...,Web Development,https://example.com/img.jpg,,6 Months,15000,12000,Beginner,John Doe,Live|Projects,Module 1|Module 2,24,yes,active,yes";



  const handleFile = async (file: File) => {

    setFileName(file.name);

    setParseErrors([]);

    const text = await file.text();

    const { rows, errors } = parseCoursesCsv(text);



    if (errors.length && !rows.length) {

      setParseErrors(errors);

      return;

    }



    setImporting(true);

    setProgress(0);

    try {

      const result = await importCoursesFromCsv(

        rows.map((r) => r.values),

        (done, total) => setProgress(Math.round((done / total) * 100))

      );

      result.errors = [...errors, ...result.errors];

      result.skipped += errors.length;

      onComplete(result);

      onClose();

    } catch (err) {

      setParseErrors([{ row: 0, message: err instanceof Error ? err.message : "Import failed" }]);

    } finally {

      setImporting(false);

      setProgress(0);

    }

  };



  return (

    <AdminModal

      open={open}

      onClose={onClose}

      title="Import Courses from CSV"

      size="sm"

      closeOnBackdrop={!importing}

      footer={

        <button type="button" onClick={onClose} disabled={importing} className={btnSecondaryBlock}>

          Cancel

        </button>

      }

    >

      <div className="space-y-4">

        <p className="text-sm text-slate-500">

          Upload a CSV to bulk add or update courses. Existing <strong>courseId</strong> values are updated (upsert).

        </p>



        <button

          type="button"

          onClick={() => {

            const blob = new Blob([sampleCsv], { type: "text/csv" });

            const url = URL.createObjectURL(blob);

            const a = document.createElement("a");

            a.href = url;

            a.download = "course-import-template.csv";

            a.click();

            URL.revokeObjectURL(url);

          }}

          className="text-sm text-[#6C3CE9] flex items-center gap-1 hover:underline"

        >

          <Download size={16} /> Download sample template

        </button>



        <input

          ref={inputRef}

          type="file"

          accept=".csv,text/csv"

          className="hidden"

          onChange={(e) => {

            const f = e.target.files?.[0];

            if (f) handleFile(f);

            e.target.value = "";

          }}

        />



        <button

          type="button"

          disabled={importing}

          onClick={() => inputRef.current?.click()}

          className="w-full border-2 border-dashed border-slate-200 rounded-xl p-6 sm:p-8 text-center hover:border-[#6C3CE9]/40 hover:bg-violet-50/50 transition-colors"

        >

          {importing ? (

            <div className="flex flex-col items-center gap-2">

              <Loader2 className="animate-spin text-[#6C3CE9]" size={28} />

              <p className="text-sm text-slate-600">Importing… {progress}%</p>

              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">

                <div className="h-full brand-gradient transition-all" style={{ width: `${progress}%` }} />

              </div>

            </div>

          ) : (

            <>

              <Upload className="mx-auto text-slate-400 mb-2" size={28} />

              <p className="text-sm font-medium text-slate-700 break-all px-2">

                {fileName || "Tap to select CSV file"}

              </p>

            </>

          )}

        </button>



        {parseErrors.length > 0 && (

          <div className="max-h-40 overflow-y-auto rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 space-y-1">

            {parseErrors.map((e, i) => (

              <p key={i} className="break-words">

                {e.row > 0 ? `Row ${e.row}` : "Error"}

                {e.courseId ? ` (${e.courseId})` : ""}: {e.message}

              </p>

            ))}

          </div>

        )}

      </div>

    </AdminModal>

  );

}


