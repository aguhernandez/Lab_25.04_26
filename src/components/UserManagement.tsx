import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getAllHubProfiles, importHubProfileAsCoach, UserRole } from '../lib/auth';
import Toast from './Toast';

interface Profile {
  id: string;
  full_name: string | null;
  role: string;
  user_id: string | null;
}

interface ToastMessage {
  message: string;
  type: 'success' | 'error';
}

export default function UserManagement() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncingHub, setSyncingHub] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ imported: number; updated: number } | null>(null);

  useEffect(() => {
    loadProfiles();
    syncHubProfiles();
  }, []);

  async function loadProfiles() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, role')
        .order('full_name');
      if (error) throw error;
      setProfiles(data || []);
    } catch {
      setToast({ message: 'Failed to load users', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function syncHubProfiles() {
    const hubUrl = import.meta.env.VITE_HUB_SUPABASE_URL;
    const hubKey = import.meta.env.VITE_HUB_SUPABASE_ANON_KEY;
    if (!hubUrl || !hubKey) return;

    setSyncingHub(true);
    try {
      const hubUsers = await getAllHubProfiles();
      if (hubUsers.length === 0) return;

      // Check which are already imported
      const { data: existing } = await supabase
        .from('profiles')
        .select('hub_user_id')
        .in('hub_user_id', hubUsers.map(u => u.user_id));

      const importedIds = new Set((existing || []).map(p => p.hub_user_id).filter(Boolean));

      let imported = 0;
      let updated = 0;

      for (const user of hubUsers) {
        if (!user.email) continue;
        const role: UserRole = user.role === 'admin' ? 'admin' : user.role === 'athlete' ? 'athlete' : 'coach';
        const success = await importHubProfileAsCoach(user.user_id, user.email, user.full_name || '', role);
        if (success) {
          if (importedIds.has(user.user_id)) updated++;
          else imported++;
        }
      }

      setSyncResult({ imported, updated });
      await loadProfiles();
    } catch (err) {
      console.error('Hub sync error:', err);
    } finally {
      setSyncingHub(false);
    }
  }

  async function handleRoleChange(profileId: string, userId: string | null, newRole: string) {
    try {
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', profileId);
      if (error) throw error;
      if (userId) {
        await supabase.from('user_roles').upsert({ user_id: userId, role: newRole }, { onConflict: 'user_id' });
      }
      setToast({ message: 'Role updated', type: 'success' });
      await loadProfiles();
    } catch {
      setToast({ message: 'Failed to update role', type: 'error' });
    }
  }

  function startEdit(profile: Profile) {
    setEditingId(profile.id);
    setEditName(profile.full_name || '');
  }

  async function saveEdit(profileId: string) {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: editName.trim() || null })
        .eq('id', profileId);
      if (error) throw error;
      setToast({ message: 'Name updated', type: 'success' });
      setEditingId(null);
      await loadProfiles();
    } catch {
      setToast({ message: 'Failed to update name', type: 'error' });
    }
  }

  async function handleDelete(profile: Profile) {
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', profile.id);
      if (error) throw error;
      setToast({ message: 'User deleted', type: 'success' });
      setDeletingId(null);
      await loadProfiles();
    } catch {
      setToast({ message: 'Failed to delete user', type: 'error' });
      setDeletingId(null);
    }
  }

  const roleBadgeClass = (role: string) => {
    if (role === 'admin') return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
    if (role === 'coach' || role === 'trainer') return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
    return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
  };

  return (
    <div className="space-y-8">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div>
        <h1 className="text-4xl font-heading font-bold text-gray-800 dark:text-white mb-2">User Management</h1>
        <p className="text-gray-600 dark:text-gray-400 text-lg">Profiles are automatically synced from HUB on load</p>
      </div>

      {/* Sync status banner */}
      {syncingHub && (
        <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-5 py-3 text-blue-700 dark:text-blue-300 text-sm">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 dark:border-blue-400 flex-shrink-0" />
          Syncing profiles from HUB...
        </div>
      )}
      {!syncingHub && syncResult && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-5 py-3 text-green-700 dark:text-green-300 text-sm">
          HUB sync complete — {syncResult.imported} new profile{syncResult.imported !== 1 ? 's' : ''} imported,{' '}
          {syncResult.updated} updated.
        </div>
      )}

      {/* Lab Users table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="bg-gradient-to-r from-[#5A4E6B] to-[#6B5D7B] dark:from-[#4A3E5B] dark:to-[#5B4D6B] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 rounded-lg p-2">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white">Lab Users</h3>
            </div>
            <button
              onClick={() => { loadProfiles(); syncHubProfiles(); }}
              disabled={syncingHub}
              className="text-white/80 hover:text-white text-sm underline disabled:opacity-50"
            >
              {syncingHub ? 'Syncing...' : 'Re-sync HUB'}
            </button>
          </div>
        </div>

        <div className="p-6">
          {loading && profiles.length === 0 ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#fdda36] mx-auto" />
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading users...</p>
            </div>
          ) : profiles.length === 0 ? (
            <p className="text-center py-8 text-gray-600 dark:text-gray-400">No users found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                    <th className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-300">Name</th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-300">User ID</th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-300">Role</th>
                    <th className="text-right py-4 px-4 font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((profile) => (
                    <tr key={profile.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="py-4 px-4">
                        {editingId === profile.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(profile.id); if (e.key === 'Escape') setEditingId(null); }}
                              className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm w-40"
                              autoFocus
                            />
                            <button onClick={() => saveEdit(profile.id)} className="text-green-600 hover:text-green-700 text-xs font-medium">Save</button>
                            <button onClick={() => setEditingId(null)} className="text-gray-500 hover:text-gray-700 text-xs">Cancel</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-900 dark:text-white font-medium">{profile.full_name || 'No name'}</span>
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${roleBadgeClass(profile.role)}`}>
                              {profile.role}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4 text-gray-600 dark:text-gray-400 font-mono text-xs">
                        {profile.user_id ? `${profile.user_id.substring(0, 8)}...` : '—'}
                      </td>
                      <td className="py-4 px-4">
                        <select
                          value={profile.role}
                          onChange={(e) => handleRoleChange(profile.id, profile.user_id, e.target.value)}
                          className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm"
                        >
                          <option value="athlete">Athlete</option>
                          <option value="coach">Coach</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {editingId !== profile.id && (
                            <button
                              onClick={() => startEdit(profile)}
                              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                              Edit
                            </button>
                          )}
                          {deletingId === profile.id ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-600 dark:text-gray-400">Delete?</span>
                              <button
                                onClick={() => handleDelete(profile)}
                                className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeletingId(null)}
                                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeletingId(profile.id)}
                              className="px-3 py-1.5 text-sm border border-red-300 dark:border-red-700 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
