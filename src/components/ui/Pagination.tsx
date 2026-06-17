"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  pageSize: number;
};

export default function Pagination({ page, totalPages, onPageChange, totalItems, pageSize }: Props) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200">
      <p className="text-sm text-slate-500">
        Showing {start}–{end} of {totalItems}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="p-2 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
        >
          <ChevronLeft size={18} />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
          .map((p, idx, arr) => (
            <span key={p} className="flex items-center">
              {idx > 0 && arr[idx - 1] !== p - 1 && (
                <span className="px-1 text-slate-400">…</span>
              )}
              <button
                type="button"
                onClick={() => onPageChange(p)}
                className={`min-w-[36px] h-9 rounded-lg text-sm font-medium ${
                  p === page
                    ? "bg-[#6C3CE9] text-white"
                    : "border border-slate-200 hover:bg-slate-50 text-slate-700"
                }`}
              >
                {p}
              </button>
            </span>
          ))}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="p-2 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

export function usePagination<T>(items: T[], pageSize = 10) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = items.slice((safePage - 1) * pageSize, safePage * pageSize);
  return { page: safePage, setPage, totalPages, paginated, pageSize };
}
