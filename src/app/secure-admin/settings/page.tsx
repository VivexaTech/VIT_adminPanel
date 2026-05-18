"use client";

import { useState } from "react";
import PageTransition from "@/components/admin/PageTransition";
import { Save, Building2, Phone, Mail, Globe, Link as LinkIcon } from "lucide-react";

export default function SettingsPage() {
  const [saving, setSaving] = useState(false);

  // In a real app, load this from Firestore settings collection
  const [settings, setSettings] = useState({
    instituteName: "Vivexa Institute of Technology",
    email: "contact@vivexatech.in",
    phone: "+91 9876543210",
    website: "https://vivexatech.in",
    facebook: "https://facebook.com/vivexatech",
    instagram: "https://instagram.com/vivexatech",
    twitter: "https://twitter.com/vivexatech",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({ ...settings, [e.target.name]: e.target.value });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    // Simulate save to Firebase
    setTimeout(() => {
      setSaving(false);
      alert("Settings saved successfully!");
    }, 1000);
  };

  return (
    <PageTransition>
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">General Settings</h1>
          <p className="text-gray-400 text-sm">Update institute details and configuration.</p>
        </div>
        
        <button 
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl hover:from-cyan-400 hover:to-blue-500 transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] disabled:opacity-70"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <Save size={18} />
          )}
          <span>{saving ? 'Saving...' : 'Save Changes'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="glass-panel p-6 rounded-2xl border border-cyan-500/20">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Building2 className="text-cyan-400" size={20} />
              Institute Profile
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Institute Name</label>
                <input 
                  type="text" 
                  name="instituteName"
                  value={settings.instituteName}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400 transition-colors" 
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Contact Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <input 
                      type="email" 
                      name="email"
                      value={settings.email}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400 transition-colors" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Contact Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <input 
                      type="text" 
                      name="phone"
                      value={settings.phone}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400 transition-colors" 
                    />
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Main Website URL</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <input 
                    type="url" 
                    name="website"
                    value={settings.website}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400 transition-colors" 
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-cyan-500/20">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <LinkIcon className="text-cyan-400" size={20} />
              Social Links
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Facebook</label>
                <input 
                  type="url" 
                  name="facebook"
                  value={settings.facebook}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400 transition-colors" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Instagram</label>
                <input 
                  type="url" 
                  name="instagram"
                  value={settings.instagram}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400 transition-colors" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Twitter / X</label>
                <input 
                  type="url" 
                  name="twitter"
                  value={settings.twitter}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400 transition-colors" 
                />
              </div>
            </div>
          </div>
        </div>
        
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-cyan-500/20 flex flex-col items-center text-center">
            <h3 className="text-white font-medium mb-4 w-full text-left">Admin Logo</h3>
            <div className="w-32 h-32 rounded-full border-2 border-dashed border-cyan-500/50 flex items-center justify-center bg-[#050B14] relative group overflow-hidden mb-4">
              <span className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">VIT</span>
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
                <span className="text-xs text-white bg-white/20 px-3 py-1 rounded-full border border-white/30">Change Logo</span>
              </div>
            </div>
            <p className="text-xs text-gray-500">Recommended: 256x256px PNG or SVG with transparent background.</p>
          </div>
          
          <div className="glass-panel p-6 rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-[#0A1121] to-cyan-900/10">
            <h3 className="text-white font-medium mb-2">System Status</h3>
            <div className="space-y-3 mt-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Database</span>
                <span className="flex items-center gap-1 text-emerald-400"><div className="w-2 h-2 rounded-full bg-emerald-400"></div> Connected</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Storage</span>
                <span className="flex items-center gap-1 text-emerald-400"><div className="w-2 h-2 rounded-full bg-emerald-400"></div> Connected</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Version</span>
                <span className="text-white">v1.0.0</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
