"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Eye, GalleryHorizontal, Pencil, Plus, Power, Trash2 } from "lucide-react";
import PageTransition from "@/components/admin/PageTransition";
import PermissionGate from "@/components/admin/PermissionGate";
import BannerFormModal from "@/components/admin/banners/BannerFormModal";
import PageHeader from "@/components/ui/PageHeader";
import AdminModal from "@/components/ui/AdminModal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Pagination, { usePagination } from "@/components/ui/Pagination";
import { useToast } from "@/context/ToastContext";
import { btnPrimary } from "@/lib/theme";
import { createBanner, deleteBanner, moveBanner, subscribeToBanners, toggleBannerActive, updateBanner } from "@/lib/bannerService";
import type { Banner, BannerInput } from "@/types/marketing";

type Pending = { kind: "delete" | "toggle"; item: Banner } | null;
export default function BannersPage() {
  const [items, setItems] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [preview, setPreview] = useState<Banner | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();
  useEffect(() => subscribeToBanners((data) => { setItems(data); setLoading(false); }, () => { setLoading(false); showToast("error", "Failed to load banners."); }), [showToast]);
  const { page, setPage, totalPages, paginated, pageSize } = usePagination(items, 8);
  const nextOrder = items.reduce((max, item) => Math.max(max, item.order), 0) + 1;
  const save = async (values: BannerInput) => {
    setSaving(true);
    try { if (editing) await updateBanner(editing.id, values); else await createBanner(values); showToast("success", editing ? "Banner updated." : "Banner created."); setFormOpen(false); setEditing(null); } finally { setSaving(false); }
  };
  const confirm = async () => {
    if (!pending) return; setSaving(true);
    try { if (pending.kind === "delete") await deleteBanner(pending.item.id); else await toggleBannerActive(pending.item.id, pending.item.active); showToast("success", pending.kind === "delete" ? "Banner deleted." : "Status updated."); setPending(null); } catch { showToast("error", "Action failed."); } finally { setSaving(false); }
  };
  const move = async (item: Banner, direction: "up" | "down") => {
    try { await moveBanner(item.id, direction); } catch { showToast("error", "Could not reorder banner."); }
  };
  return <PermissionGate permission="manage_banners"><PageTransition>
    <PageHeader title="Website Banners" subtitle="Manage and order homepage hero banners." icon={<GalleryHorizontal className="text-[#6C3CE9]" />} actions={<button className={btnPrimary} onClick={() => { setEditing(null); setFormOpen(true); }}><Plus size={17} />Add Banner</button>} />
    {loading ? <div className="glass-card rounded-2xl p-12 text-center text-slate-400">Loading banners...</div> : items.length === 0 ? <div className="glass-card rounded-2xl p-12 text-center text-slate-400">No banners yet.</div> :
      <><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{paginated.map((item) => {
        const index = items.findIndex((banner) => banner.id === item.id);
        return <article key={item.id} className="glass-card overflow-hidden rounded-2xl">
          <div className="relative aspect-video bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.imageUrl} alt={item.title || "Website banner"} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
            <div className="absolute bottom-0 p-4 text-white"><p className="font-semibold">{item.title || "Untitled banner"}</p>{item.subtitle && <p className="line-clamp-1 text-xs text-white/75">{item.subtitle}</p>}</div>
            <span className={`absolute right-3 top-3 rounded-full px-2 py-1 text-xs ${item.active ? "bg-emerald-500 text-white" : "bg-slate-900/70 text-white"}`}>{item.active ? "Active" : "Inactive"}</span>
          </div>
          <div className="flex items-center justify-between p-3"><span className="text-xs text-slate-500">Order {item.order}</span><div className="flex"><Action title="Move up" disabled={index === 0} onClick={() => move(item, "up")}><ArrowUp size={16} /></Action><Action title="Move down" disabled={index === items.length - 1} onClick={() => move(item, "down")}><ArrowDown size={16} /></Action><Action title="Preview" onClick={() => setPreview(item)}><Eye size={16} /></Action><Action title="Edit" onClick={() => { setEditing(item); setFormOpen(true); }}><Pencil size={16} /></Action><Action title={item.active ? "Disable" : "Enable"} onClick={() => setPending({ kind: "toggle", item })}><Power size={16} /></Action><Action title="Delete" danger onClick={() => setPending({ kind: "delete", item })}><Trash2 size={16} /></Action></div></div>
        </article>;
      })}</div><Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={items.length} pageSize={pageSize} /></>}
    <BannerFormModal open={formOpen} banner={editing} nextOrder={nextOrder} saving={saving} onClose={() => setFormOpen(false)} onSubmit={save} />
    <AdminModal open={Boolean(preview)} onClose={() => setPreview(null)} title="Banner Preview" size="xl">{preview && <div className="relative aspect-video overflow-hidden rounded-2xl bg-slate-900">
      {/* eslint-disable-next-line @next/next/no-img-element */}<img src={preview.imageUrl} alt="" className="h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/35 to-transparent" /><div className="absolute inset-0 flex max-w-2xl flex-col justify-center p-8 text-white sm:p-14"><h2 className="text-3xl font-bold sm:text-5xl">{preview.title}</h2>{preview.subtitle && <p className="mt-3 text-base text-white/80 sm:text-xl">{preview.subtitle}</p>}{preview.buttonText && <span className="mt-6 w-fit rounded-xl bg-[#6C3CE9] px-5 py-3 text-sm font-semibold">{preview.buttonText}</span>}</div>
    </div>}</AdminModal>
    <ConfirmDialog open={Boolean(pending)} title={pending?.kind === "delete" ? "Delete banner?" : "Change banner status?"} message={pending ? `Confirm action for banner "${pending.item.title || pending.item.id}".` : ""} destructive={pending?.kind === "delete"} loading={saving} onConfirm={confirm} onCancel={() => setPending(null)} />
  </PageTransition></PermissionGate>;
}
function Action({ title, onClick, danger, disabled, children }: { title: string; onClick: () => void; danger?: boolean; disabled?: boolean; children: React.ReactNode }) { return <button title={title} disabled={disabled} onClick={onClick} className={`rounded-lg p-2 disabled:opacity-25 ${danger ? "text-red-500 hover:bg-red-50" : "text-slate-500 hover:bg-violet-50 hover:text-[#6C3CE9]"}`}>{children}</button>; }
