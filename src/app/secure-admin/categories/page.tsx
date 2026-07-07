"use client";

import { useEffect, useState } from "react";
import PageTransition from "@/components/admin/PageTransition";
import { Plus, Pencil, Trash2, X, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { adminApi } from "@/lib/adminApi";
import { btnPrimaryBlock, btnSecondaryBlock, inputClass, labelClass, modalFooter, pageHeader, pageTitle, pageSubtitle } from "@/lib/theme";

type Category = {
  id: string;
  name: string;
  iconName?: string;
  order?: number;
  active?: boolean;
};

const ICON_OPTIONS = ["code", "megaphone", "calculator", "chart", "brain", "book", "school", "laptop", "bulb"];

export default function CategoriesPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [seeding, setSeeding] = useState(false);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await adminApi.fetchCategories();
      setCategories(res.categories || []);
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await adminApi.seedCategories();
      showToast("success", "Default categories seeded.");
      fetchCategories();
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Seed failed");
    } finally {
      setSeeding(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") || ""),
      iconName: String(fd.get("iconName") || "book"),
      order: Number(fd.get("order") || 99),
      active: fd.get("active") === "on",
    };
    try {
      if (editing) {
        await adminApi.updateCategory({ id: editing.id, ...payload });
        showToast("success", "Category updated.");
      } else {
        await adminApi.createCategory(payload);
        showToast("success", "Category created.");
      }
      setShowModal(false);
      setEditing(null);
      fetchCategories();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Save failed");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this category? Courses using it will keep their category text.")) return;
    try {
      await adminApi.deleteCategory(id);
      showToast("success", "Category deleted.");
      fetchCategories();
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <PageTransition>
      <div className={pageHeader}>
        <div>
          <h1 className={pageTitle}>Category Management</h1>
          <p className={pageSubtitle}>Manage course categories, icons, and display order for app & website.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={handleSeed} disabled={seeding} className={btnSecondaryBlock}>
            <RefreshCw size={16} className={seeding ? "animate-spin" : ""} /> Seed Defaults
          </button>
          <button type="button" onClick={() => { setEditing(null); setShowModal(true); }} className={btnPrimaryBlock}>
            <Plus size={18} /> Add Category
          </button>
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Order</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Name</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Icon</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">Loading...</td></tr>
            ) : categories.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">No categories. Seed defaults or add one.</td></tr>
            ) : (
              categories.map((cat) => (
                <tr key={cat.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-5 py-4 text-sm">{cat.order ?? "—"}</td>
                  <td className="px-5 py-4 font-medium text-slate-900">{cat.name}</td>
                  <td className="px-5 py-4 font-mono text-sm text-[#6C3CE9]">{cat.iconName || "book"}</td>
                  <td className="px-5 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cat.active !== false ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {cat.active !== false ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button type="button" onClick={() => { setEditing(cat); setShowModal(true); }} className="p-2 text-slate-400 hover:text-[#6C3CE9]">
                      <Pencil size={16} />
                    </button>
                    <button type="button" onClick={() => handleDelete(cat.id)} className="p-2 text-slate-400 hover:text-red-500">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold">{editing ? "Edit Category" : "New Category"}</h2>
              <button type="button" onClick={() => { setShowModal(false); setEditing(null); }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className={labelClass}>Name</label>
                <input name="name" required defaultValue={editing?.name || ""} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Icon Name</label>
                <select name="iconName" defaultValue={editing?.iconName || "book"} className={inputClass}>
                  {ICON_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Display Order</label>
                <input name="order" type="number" min={1} defaultValue={editing?.order ?? 99} className={inputClass} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input name="active" type="checkbox" defaultChecked={editing?.active !== false} />
                Active (visible on app & website)
              </label>
              <div className={modalFooter}>
                <button type="button" onClick={() => { setShowModal(false); setEditing(null); }} className={btnSecondaryBlock}>Cancel</button>
                <button type="submit" className={btnPrimaryBlock}>{editing ? "Save" : "Create"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageTransition>
  );
}
