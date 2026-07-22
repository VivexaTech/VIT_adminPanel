"use client";

import { useEffect, useMemo, useState } from "react";
import { Megaphone, Pencil, Plus, Power, Search, Trash2 } from "lucide-react";
import PageTransition from "@/components/admin/PageTransition";
import PermissionGate from "@/components/admin/PermissionGate";
import NoticeFormModal from "@/components/admin/notices/NoticeFormModal";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { usePagination } from "@/components/ui/Pagination";
import { useToast } from "@/context/ToastContext";
import { btnPrimary, inputClass, toolbar } from "@/lib/theme";
import { createNotice, deleteNotice, subscribeToNotices, toggleNoticeActive, updateNotice } from "@/lib/noticeService";
import type { Notice, NoticeInput } from "@/types/marketing";

type Pending = { kind: "delete" | "toggle"; item: Notice } | null;
export default function NoticesPage() {
  const [items, setItems] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<Notice | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();
  useEffect(() => subscribeToNotices((data) => { setItems(data); setLoading(false); }, () => { setLoading(false); showToast("error", "Failed to load notices."); }), [showToast]);
  const filtered = useMemo(() => items.filter((item) => item.title.toLowerCase().includes(search.toLowerCase()) && (type === "all" || item.type === type) && (status === "all" || String(item.active) === status)), [items, search, type, status]);
  const { page, setPage, totalPages, paginated, pageSize } = usePagination(filtered, 10);
  const save = async (values: NoticeInput) => {
    setSaving(true);
    try { if (editing) await updateNotice(editing.id, values); else await createNotice(values); showToast("success", editing ? "Notice updated." : "Notice created."); setFormOpen(false); setEditing(null); } finally { setSaving(false); }
  };
  const confirm = async () => {
    if (!pending) return; setSaving(true);
    try { if (pending.kind === "delete") await deleteNotice(pending.item.id); else await toggleNoticeActive(pending.item.id, pending.item.active); showToast("success", pending.kind === "delete" ? "Notice deleted." : "Status updated."); setPending(null); } catch { showToast("error", "Action failed."); } finally { setSaving(false); }
  };
  return <PermissionGate permission="manage_notices"><PageTransition>
    <PageHeader title="Offers & Notices" subtitle="Publish offers, notices, popups, and admission announcements." icon={<Megaphone className="text-[#6C3CE9]" />} actions={<button className={btnPrimary} onClick={() => { setEditing(null); setFormOpen(true); }}><Plus size={17} />Add Notice</button>} />
    <div className={toolbar}><div className="relative flex-1"><Search className="absolute left-3 top-3 text-slate-400" size={17} /><input className={`${inputClass} pl-10`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title" /></div><select className={`${inputClass} sm:w-44`} value={type} onChange={(e) => setType(e.target.value)}><option value="all">All types</option>{["offer", "notice", "popup", "admission"].map((value) => <option key={value}>{value}</option>)}</select><select className={`${inputClass} sm:w-44`} value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All statuses</option><option value="true">Active</option><option value="false">Inactive</option></select></div>
    <DataTable minWidth={960} pagination={{ page, totalPages, onPageChange: setPage, totalItems: filtered.length, pageSize }}>
      <thead><tr className="border-b bg-slate-50/80">{["Priority", "Notice", "Type", "Display", "Schedule", "Actions"].map((label) => <th key={label} className="px-5 py-3 text-xs uppercase text-slate-500">{label}</th>)}</tr></thead>
      <tbody>{loading ? <Row text="Loading notices..." /> : paginated.length === 0 ? <Row text="No notices found." /> : paginated.map((item) => <tr key={item.id} className="border-b border-slate-100">
        <td className="px-5 py-4 font-semibold">{item.priority}</td>
        <td className="max-w-sm px-5 py-4"><p className="font-medium">{item.title}</p><p className="line-clamp-2 text-xs text-slate-500">{item.description}</p></td>
        <td className="px-5 py-4"><span className="rounded-full px-2.5 py-1 text-xs capitalize text-white" style={{ backgroundColor: item.color }}>{item.type}</span></td>
        <td className="px-5 py-4"><div className="flex max-w-52 flex-wrap gap-1"><Indicator on={item.active} label="Active" /><Indicator on={item.showInMarquee} label="Marquee" /><Indicator on={item.showAsPopup} label="Popup" /><Indicator on={item.showOnHomepage} label="Homepage" /></div></td>
        <td className="px-5 py-4 text-xs text-slate-600">{item.startDate || "Now"} → {item.endDate || "Open"}</td>
        <td className="px-5 py-4"><div className="flex gap-1"><Action title="Edit" onClick={() => { setEditing(item); setFormOpen(true); }}><Pencil size={16} /></Action><Action title={item.active ? "Disable" : "Enable"} onClick={() => setPending({ kind: "toggle", item })}><Power size={16} /></Action><Action title="Delete" danger onClick={() => setPending({ kind: "delete", item })}><Trash2 size={16} /></Action></div></td>
      </tr>)}</tbody>
    </DataTable>
    <NoticeFormModal open={formOpen} notice={editing} saving={saving} onClose={() => setFormOpen(false)} onSubmit={save} />
    <ConfirmDialog open={Boolean(pending)} title={pending?.kind === "delete" ? "Delete notice?" : "Change notice status?"} message={pending ? `Confirm action for "${pending.item.title}".` : ""} destructive={pending?.kind === "delete"} loading={saving} onConfirm={confirm} onCancel={() => setPending(null)} />
  </PageTransition></PermissionGate>;
}
function Row({ text }: { text: string }) { return <tr><td colSpan={6} className="p-10 text-center text-slate-400">{text}</td></tr>; }
function Indicator({ on, label }: { on: boolean; label: string }) { return <span className={`rounded-full px-2 py-0.5 text-[11px] ${on ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>{label}</span>; }
function Action({ title, onClick, danger, children }: { title: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) { return <button title={title} onClick={onClick} className={`rounded-lg p-2 ${danger ? "text-red-500 hover:bg-red-50" : "text-slate-500 hover:bg-violet-50 hover:text-[#6C3CE9]"}`}>{children}</button>; }
