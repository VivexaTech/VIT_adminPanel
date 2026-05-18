"use client";

import { useState, useEffect } from "react";
import PageTransition from "@/components/admin/PageTransition";
import { Search, Plus, Trash2, X, Shield, User as UserIcon } from "lucide-react";
import { collection, getDocs, deleteDoc, doc, setDoc, query, orderBy, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

export default function UsersPage() {
  const { user } = useAuth();
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = async () => {
    try {
      const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsersList(data);
    } catch (error) {
      console.error("Error fetching users: ", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSaveUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (user?.role !== 'Super Admin') return;

    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    
    // We use email as the document ID for easy lookup during login
    const data = {
      fullName: formData.get("fullName"),
      email: email,
      role: formData.get("role"),
      status: formData.get("status"),
      createdAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, "users", email), data);
      setShowModal(false);
      fetchUsers();
    } catch (error) {
      console.error("Error creating user: ", error);
      alert("Failed to create user.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    if (user?.role !== 'Super Admin') return;
    if (id === user?.email) {
      alert("You cannot suspend yourself.");
      return;
    }
    
    const newStatus = currentStatus === "active" ? "suspended" : "active";
    if (window.confirm(`Change user status to ${newStatus}?`)) {
      try {
        await updateDoc(doc(db, "users", id), { status: newStatus });
        fetchUsers();
      } catch (error) {
        console.error("Error toggling user status", error);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (user?.role !== 'Super Admin') return;
    if (id === user?.email) {
      alert("You cannot delete yourself.");
      return;
    }

    if (window.confirm("Are you sure you want to permanently delete this user? They will lose all access.")) {
      try {
        await deleteDoc(doc(db, "users", id));
        fetchUsers();
      } catch (error) {
        console.error("Error deleting user: ", error);
      }
    }
  };

  const filteredUsers = usersList.filter(u => 
    u.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isSuperAdmin = user?.role === 'Super Admin';

  return (
    <PageTransition>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">User Management</h1>
          <p className="text-gray-400 text-sm">Manage administrators and their access roles.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#0A1121] border border-cyan-500/20 rounded-xl text-white focus:outline-none focus:border-cyan-400 transition-colors"
            />
          </div>
          {isSuperAdmin && (
            <button 
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-400 hover:to-purple-500 transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)] shrink-0"
            >
              <Plus size={18} />
              <span className="hidden sm:block">Add User</span>
            </button>
          )}
        </div>
      </div>

      {!isSuperAdmin && (
        <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400 text-sm flex items-center gap-2">
          <Shield size={16} />
          You have 'Admin' privileges. Only 'Super Admins' can add, edit, or delete users.
        </div>
      )}

      <div className="glass-panel rounded-2xl overflow-hidden border border-cyan-500/20">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-cyan-500/20 bg-[#0A1121]/50">
                <th className="px-6 py-4 text-sm font-medium text-gray-400">User</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-400">Role</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-400">Status</th>
                {isSuperAdmin && <th className="px-6 py-4 text-sm font-medium text-gray-400 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 4 : 3} className="px-6 py-8 text-center text-gray-400">Loading users...</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 4 : 3} className="px-6 py-8 text-center text-gray-400">No users found.</td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
                          <UserIcon size={18} />
                        </div>
                        <div>
                          <div className="font-medium text-white flex items-center gap-2">
                            {u.fullName} {u.email === user?.email && <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full uppercase tracking-wider">You</span>}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                        u.role === 'Super Admin' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 
                        'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                        u.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                        'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        {u.status || 'active'}
                      </span>
                    </td>
                    {isSuperAdmin && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleToggleStatus(u.id, u.status || 'active')}
                            title={u.status === 'active' ? 'Suspend Access' : 'Restore Access'}
                            className={`p-2 rounded-lg transition-colors ${u.status === 'active' ? 'text-yellow-400 hover:bg-yellow-500/10' : 'text-emerald-400 hover:bg-emerald-500/10'}`}
                            disabled={u.email === user?.email}
                          >
                            <Shield size={16} className={u.email === user?.email ? 'opacity-30' : ''} />
                          </button>
                          
                          <button 
                            onClick={() => handleDelete(u.id)}
                            title="Delete User"
                            className={`p-2 rounded-lg transition-colors text-gray-400 hover:text-red-400 hover:bg-red-500/10`}
                            disabled={u.email === user?.email}
                          >
                            <Trash2 size={16} className={u.email === user?.email ? 'opacity-30' : ''} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && isSuperAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl border border-cyan-500/30 overflow-hidden shadow-2xl relative">
            <div className="p-6 border-b border-cyan-500/20 flex justify-between items-center bg-[#0A1121]/80 shrink-0">
              <div>
                <h2 className="text-xl font-bold text-white">Add New User</h2>
                <p className="text-xs text-gray-400 mt-1">They must sign up via Firebase Auth first, then you grant them a role here.</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSaveUser} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Full Name</label>
                <input name="fullName" required placeholder="John Doe" className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Email Address (Must match Firebase Auth login)</label>
                <input name="email" type="email" required placeholder="admin@vit.com" className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Role</label>
                <select name="role" required className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400 appearance-none">
                  <option value="Admin">Admin (Cannot delete data/users)</option>
                  <option value="Super Admin">Super Admin (Full Access)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Status</label>
                <select name="status" required className="w-full px-4 py-2 bg-[#050B14] border border-cyan-500/30 rounded-xl text-white focus:outline-none focus:border-cyan-400 appearance-none">
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              </div>
              
              <div className="p-4 flex justify-end gap-3 bg-[#0A1121]/90 border-t border-cyan-500/20 shrink-0">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-400 hover:text-white transition-colors">
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="px-6 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white rounded-xl transition-colors shadow-[0_0_10px_rgba(99,102,241,0.3)] disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Grant Access'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageTransition>
  );
}
