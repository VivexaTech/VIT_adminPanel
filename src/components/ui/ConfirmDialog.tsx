"use client";



import { AlertTriangle } from "lucide-react";

import { btnPrimary, btnPrimaryBlock, btnSecondaryBlock, modalFooter, modalOverlay, modalPanelSm } from "@/lib/theme";



type Props = {

  open: boolean;

  title: string;

  message: string;

  confirmLabel?: string;

  destructive?: boolean;

  loading?: boolean;

  onConfirm: () => void;

  onCancel: () => void;

};



export default function ConfirmDialog({

  open,

  title,

  message,

  confirmLabel = "Confirm",

  destructive,

  loading,

  onConfirm,

  onCancel,

}: Props) {

  if (!open) return null;



  return (

    <div className={modalOverlay} style={{ zIndex: 70 }} onClick={(e) => e.target === e.currentTarget && onCancel()}>

      <div className={modalPanelSm} onClick={(e) => e.stopPropagation()}>

        <div className="p-4 sm:p-6">

          <div className="flex items-start gap-3 sm:gap-4">

            <div

              className={`p-2.5 sm:p-3 rounded-xl shrink-0 ${

                destructive ? "bg-red-50 text-red-500" : "bg-violet-50 text-[#6C3CE9]"

              }`}

            >

              <AlertTriangle size={22} />

            </div>

            <div className="min-w-0">

              <h3 className="text-base sm:text-lg font-semibold text-slate-900">{title}</h3>

              <p className="text-sm text-slate-500 mt-1 whitespace-pre-line break-words">{message}</p>

            </div>

          </div>

        </div>

        <div className={modalFooter}>

          <button type="button" onClick={onCancel} disabled={loading} className={btnSecondaryBlock}>

            Cancel

          </button>

          <button

            type="button"

            onClick={onConfirm}

            disabled={loading}

            className={

              destructive

                ? "inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 sm:px-5 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50"

                : btnPrimaryBlock

            }

          >

            {loading ? "Please wait..." : confirmLabel}

          </button>

        </div>

      </div>

    </div>

  );

}


