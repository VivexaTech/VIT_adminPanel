"use client";

import { tableCard, tableWrap } from "@/lib/theme";
import Pagination from "@/components/ui/Pagination";

type PaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  pageSize: number;
};

type Props = {
  children: React.ReactNode;
  minWidth?: number;
  pagination?: PaginationProps;
  className?: string;
};

export default function DataTable({
  children,
  minWidth = 640,
  pagination,
  className = "",
}: Props) {
  return (
    <div className={`${tableCard} ${className}`}>
      <div className={tableWrap}>
        <table className="w-full text-left" style={{ minWidth }}>
          {children}
        </table>
      </div>
      {pagination && <Pagination {...pagination} />}
    </div>
  );
}
