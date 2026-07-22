"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgePercent, Pencil, Plus, Search, Trash2, Power } from "lucide-react";
import PageTransition from "@/components/admin/PageTransition";
import PermissionGate from "@/components/admin/PermissionGate";
import DiscountFormModal from "@/components/admin/discounts/DiscountFormModal";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { usePagination } from "@/components/ui/Pagination";
import { useToast } from "@/context/ToastContext";
import { usePermissions } from "@/hooks/usePermissions";
import { btnPrimary, inputClass, toolbar } from "@/lib/theme";
import { createDiscount, deleteDiscount, subscribeToDiscounts, toggleDiscountActive, updateDiscount } from "@/lib/discountService";
import type { Discount, DiscountInput } from "@/types/marketing";

type Pending = { kind: "delete" | "toggle"; item: Discount } | null;

export default function DiscountsPage() {
  const [items, setItems] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<Discount | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const { showToast } = useToast();
  const { isSuperAdmin } = usePermissions();
  useEffect(() => subscribeToDiscounts((data) => { setItems(data); setLoading(false); }, () => { setLoading(false); showToast("error", "Failed to load discounts."); }), [showToast]);
  const filtered = useMemo(() => items.filter((item) => {
    const matchesSearch = `${item.name} ${item.code}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (status === "all" || String(item.active) === status);
  }), [items, search, status]);
  const { page, setPage, totalPages, paginated, pageSize } = usePagination(filtered, 10);
  const save = async (values: DiscountInput) => {
    setSaving(true);
    try {
      if (editing) await updateDiscount(editing.id, values); else await createDiscount(values);
      showToast("success", editing ? "Discount updated." : "Discount created.");
      setFormOpen(false); setEditing(null);
    } finally { setSaving(false); }
  };
  const confirm = async () => {
    if (!pending) return;
    setSaving(true);
    try {
      if (pending.kind === "delete") await deleteDiscount(pending.item.id);
      else await toggleDiscountActive(pending.item.id, pending.item.active);
      showToast("success", pending.kind === "delete" ? "Discount deleted." : "Discount status updated.");
      setPending(null);
    } catch { showToast("error", "Action failed."); } finally { setSaving(false); }
  };
  return <PermissionGate permission="manage_discounts"><PageTransition>
    <PageHeader title="Discounts" subtitle="Create and manage reusable fee discount codes." icon={<BadgePercent className="text-[#6C3CE9]" />} actions={<button className={btnPrimary} onClick={() => { setEditing(null); setFormOpen(true); }}><Plus size={17} />Add Discount</button>} />
    <div className={toolbar}><div className="relative flex-1"><Search className="absolute left-3 top-3 text-slate-400" size={17} /><input className={`${inputClass} pl-10`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or code" /></div><select className={`${inputClass} sm:w-44`} value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All statuses</option><option value="true">Active</option><option value="false">Inactive</option></select></div>
    <DataTable minWidth={900} pagination={{ page, totalPages, onPageChange: setPage, totalItems: filtered.length, pageSize }}>
      <thead><tr className="border-b bg-slate-50/80">{["Name / Code", "Type", "Value", "Usage", "Expiry", "Status", "Actions"].map((label) => <th key={label} className="px-5 py-3 text-xs uppercase text-slate-500">{label}</th>)}</tr></thead>
      <tbody>{loading ? <Row text="Loading discounts..." /> : paginated.length === 0 ? <Row text="No discounts found." /> : paginated.map((item) => {
        const expired = Boolean(item.expiryDate && item.expiryDate < new Date().toISOString().slice(0, 10));
        return <tr key={item.id} className="border-b border-slate-100">
          <td className="px-5 py-4"><p className="font-medium">{item.name}</p><code className="text-xs text-[#6C3CE9]">{item.code}</code></td>
          <td className="px-5 py-4"><Pill label={item.type} color="violet" /></td><td className="px-5 py-4 font-medium">{item.type === "percentage" ? `${item.value}%` : `₹${item.value}`}</td>
          <td className="px-5 py-4 text-sm text-slate-600">{item.usedCount}{item.usageLimit ? ` / ${item.usageLimit}` : ""}</td>
          <td className="px-5 py-4"><Pill label={expired ? "Expired" : item.expiryDate || "No expiry"} color={expired ? "red" : "gray"} /></td>
          <td className="px-5 py-4"><Pill label={item.active ? "Active" : "Inactive"} color={item.active ? "green" : "gray"} /></td>
          <td className="px-5 py-4"><div className="flex gap-1"><Action title="Edit" onClick={() => { setEditing(item); setFormOpen(true); }}><Pencil size={16} /></Action><Action title={item.active ? "Disable" : "Enable"} onClick={() => setPending({ kind: "toggle", item })}><Power size={16} /></Action>{isSuperAdmin && <Action title="Delete" danger onClick={() => setPending({ kind: "delete", item })}><Trash2 size={16} /></Action>}</div></td>
        </tr>;
      })}</tbody>
    </DataTable>
    <DiscountFormModal open={formOpen} discount={editing} saving={saving} onClose={() => setFormOpen(false)} onSubmit={save} />
    <ConfirmDialog open={Boolean(pending)} title={pending?.kind === "delete" ? "Delete discount?" : "Change discount status?"} message={pending ? `Confirm action for "${pending.item.name}".` : ""} destructive={pending?.kind === "delete"} loading={saving} onConfirm={confirm} onCancel={() => setPending(null)} />
  </PageTransition></PermissionGate>;
}

function Row({ text }: { text: string }) { return <tr><td colSpan={7} className="p-10 text-center text-slate-400">{text}</td></tr>; }
function Pill({ label, color }: { label: string; color: "violet" | "red" | "green" | "gray" }) { const styles = { violet: "bg-violet-50 text-violet-700", red: "bg-red-50 text-red-700", green: "bg-emerald-50 text-emerald-700", gray: "bg-slate-100 text-slate-600" }; return <span className={`rounded-full px-2.5 py-1 text-xs capitalize ${styles[color]}`}>{label}</span>; }
function Action({ title, onClick, danger, children }: { title: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) { return <button title={title} onClick={onClick} className={`rounded-lg p-2 ${danger ? "text-red-500 hover:bg-red-50" : "text-slate-500 hover:bg-violet-50 hover:text-[#6C3CE9]"}`}>{children}</button>; }
