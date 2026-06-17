"use client";

import { useEffect, useState } from "react";
import PageTransition from "@/components/admin/PageTransition";
import { DEFAULT_SETTINGS, saveSettings, subscribeToSettings } from "@/lib/settingsService";
import { useToast } from "@/context/ToastContext";
import { btnPrimary, inputClass, labelClass } from "@/lib/theme";
import { Save, Building2 } from "lucide-react";
import type { InstituteSettings } from "@/types/erp";

export default function SettingsPage() {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<InstituteSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return subscribeToSettings((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({ ...settings, [e.target.name]: e.target.value });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveSettings(settings);
      showToast("success", "Settings saved and synced to student app.");
    } catch {
      showToast("error", "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="p-12 text-center text-slate-400">Loading settings...</div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <form onSubmit={handleSave}>
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="text-[#6C3CE9]" size={26} /> Institute Settings
            </h1>
            <p className="text-slate-500 text-sm mt-1">Manage institute details, contact, and WhatsApp.</p>
          </div>
          <button type="submit" disabled={saving} className={btnPrimary}>
            <Save size={18} /> {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>

        <div className="glass-card rounded-2xl p-6 space-y-4 max-w-2xl">
          <div><label className={labelClass}>Institute Name</label><input name="instituteName" className={inputClass} value={settings.instituteName} onChange={handleChange} /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className={labelClass}>Email</label><input name="email" type="email" className={inputClass} value={settings.email} onChange={handleChange} /></div>
            <div><label className={labelClass}>Phone</label><input name="phone" className={inputClass} value={settings.phone} onChange={handleChange} /></div>
            <div><label className={labelClass}>WhatsApp</label><input name="whatsapp" className={inputClass} value={settings.whatsapp} onChange={handleChange} /></div>
            <div><label className={labelClass}>Website</label><input name="website" className={inputClass} value={settings.website} onChange={handleChange} /></div>
          </div>
          <div><label className={labelClass}>Address</label><input name="address" className={inputClass} value={settings.address || ""} onChange={handleChange} /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className={labelClass}>Facebook</label><input name="facebook" className={inputClass} value={settings.facebook || ""} onChange={handleChange} /></div>
            <div><label className={labelClass}>Instagram</label><input name="instagram" className={inputClass} value={settings.instagram || ""} onChange={handleChange} /></div>
            <div><label className={labelClass}>Twitter</label><input name="twitter" className={inputClass} value={settings.twitter || ""} onChange={handleChange} /></div>
            <div><label className={labelClass}>YouTube</label><input name="youtube" className={inputClass} value={settings.youtube || ""} onChange={handleChange} /></div>
          </div>
        </div>
      </form>
    </PageTransition>
  );
}
