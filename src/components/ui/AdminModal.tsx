"use client";

import { X } from "lucide-react";
import {
  modalOverlay,
  modalHeader,
  modalBody,
  modalFooter,
  modalPanelSm,
  modalPanelMd,
  modalPanelLg,
  modalPanelXl,
} from "@/lib/theme";

type Size = "sm" | "md" | "lg" | "xl";

const PANEL: Record<Size, string> = {
  sm: modalPanelSm,
  md: modalPanelMd,
  lg: modalPanelLg,
  xl: modalPanelXl,
};

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: Size;
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeOnBackdrop?: boolean;
};

export default function AdminModal({
  open,
  onClose,
  title,
  subtitle,
  size = "md",
  children,
  footer,
  closeOnBackdrop = true,
}: Props) {
  if (!open) return null;

  return (
    <div
      className={modalOverlay}
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <div className={PANEL[size]} onClick={(e) => e.stopPropagation()}>
        <div className={modalHeader}>
          <div className="min-w-0 flex-1 pr-2">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 truncate">{title}</h2>
            {subtitle && <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div className={modalBody}>{children}</div>
        {footer ? <div className={modalFooter}>{footer}</div> : null}
      </div>
    </div>
  );
}
