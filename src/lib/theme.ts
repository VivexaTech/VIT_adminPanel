/** Vivexa brand theme — matches the mobile student app */

export const vivexaTheme = {

  colors: {

    primary: "#6C3CE9",

    primaryLight: "#EDE7FF",

    primaryDark: "#4A1FB8",

    secondary: "#00C9A7",

    background: "#F4F6FA",

    surface: "#FFFFFF",

    sidebar: "#FFFFFF",

    sidebarBorder: "#E2E8F0",

    text: "#0F172A",

    textSecondary: "#64748B",

    textMuted: "#94A3B8",

    border: "#E2E8F0",

    success: "#10B981",

    warning: "#F59E0B",

    error: "#EF4444",

    info: "#3B82F6",

    gradientStart: "#6C3CE9",

    gradientEnd: "#9B5DE5",

  },

} as const;



export const inputClass =

  "w-full min-w-0 px-3 sm:px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6C3CE9]/30 focus:border-[#6C3CE9] transition-colors";



export const selectClass = `${inputClass} appearance-none`;



export const textareaClass =

  "w-full min-w-0 px-3 sm:px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6C3CE9]/30 focus:border-[#6C3CE9] transition-colors resize-y";



export const labelClass = "text-sm font-medium text-slate-600 mb-1.5 block";



export const btnPrimary =

  "inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6C3CE9] to-[#9B5DE5] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm";



export const btnSecondary =

  "inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors";



/** Full-width on mobile, auto on sm+ */

export const btnPrimaryBlock = `${btnPrimary} w-full sm:w-auto`;

export const btnSecondaryBlock = `${btnSecondary} w-full sm:w-auto`;



/** Responsive modal shell */

export const modalOverlay =

  "fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto";



export const modalPanel =

  "bg-white w-full sm:rounded-2xl border border-slate-200 shadow-xl max-h-[92dvh] sm:max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl";



export const modalPanelSm = `${modalPanel} sm:max-w-md`;

export const modalPanelMd = `${modalPanel} sm:max-w-2xl`;

export const modalPanelLg = `${modalPanel} sm:max-w-4xl`;

export const modalPanelXl = `${modalPanel} sm:max-w-5xl`;



export const modalHeader =

  "flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-100 shrink-0";



export const modalBody = "flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-4 sm:py-5 min-h-0";



export const modalFooter =

  "flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 shrink-0";



/** Page layout */

export const pageHeader =

  "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6";



export const pageHeaderActions =

  "flex flex-col sm:flex-row gap-2 w-full sm:w-auto shrink-0";



export const pageTitle = "text-xl sm:text-2xl font-bold text-slate-900";



export const pageSubtitle = "text-slate-500 text-sm mt-1";



export const toolbar =

  "glass-card rounded-2xl p-3 sm:p-4 mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center";



export const formGrid =

  "grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4";



export const formGridFull = "sm:col-span-2";



export const statsGrid =

  "grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6";



export const tableWrap = "overflow-x-auto overscroll-x-contain";



export const tableCard = "glass-card rounded-2xl overflow-hidden";



export const filterRow =

  "flex flex-col sm:flex-row gap-3 w-full";


