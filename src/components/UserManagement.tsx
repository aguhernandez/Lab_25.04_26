import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getAllHubProfiles, importHubProfileAsCoach, checkImportedHubProfiles, HubProfile, UserRole } from '../lib/auth';
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
  const [hubProfiles, setHubProfiles] = useState<HubProfile[]>([]);
  const [importedHubIds, setImportedHubIds] = useState<Set<string>>(new Set());
  const [selectedRoles, setSelectedRoles] = useState<Record<string, UserRole>>({});
  const [loading, setLoading] = useState(false);
  const [loadingHub, setLoadingHub] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [hubMessage, setHubMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadProfiles();
    loadHubProfiles();
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
    } catch (error) {
      console.error('Error loading profiles:', error);
      setToast({ message: 'Failed to load users', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function loadHubProfiles() {
    setLoadingHub(true);
    setHubMessage(null);

    const hubUrl = import.meta.env.VITE_HUB_SUPABASE_URL;
    const hubKey = import.meta.env.VITE_HUB_SUPABASE_ANON_KEY;

    if (!hubUrl || !hubKey) {
      setHubMessage({ type: 'error', text: 'HUB not configured. Set VITE_HUB_SUPABASE_URL and VITE_HUB_SUPABASE_ANON_KEY in .env.' });
      setLoadingHub(false);
      return;
    }

    try {
      const profiles = await getAllHubProfiles();
      setHubProfiles(profiles);

      if (profiles.length > 0) {
        const imported = await checkImportedHubProfiles(profiles.map(p => p.user_id));
        setImportedHubIds(imported);

        const defaults: Record<string, UserRole> = {};
        profiles.forEach(p => {
          defaults[p.user_id] = p.role === 'admin' ? 'admin' : 'coach';
        });
        setSelectedRoles(defaults);
      }
    } catch (error) {
      console.error('Error loading HUB profiles:', error);
      setHubMessage({ type: 'error', text: 'Failed to load HUB profiles.' });
    } finally {
      setLoadingHub(false);
    }
  }

  async function handleImport(user: HubProfile) {
    if (!user.email) return;
    setImporting(user.user_id);
    setHubMessage(null);
    const isUpdate = importedHubIds.has(user.user_id);
    const role = selectedRoles[user.user_id] ?? 'coach';

    try {
      const success = await importHubProfileAsCoach(user.user_id, user.email, user.full_name || '', role);
      if (success) {
        setHubMessage({ type: 'success', text: isUpdate ? 'User updated successfully' : 'User imported successfully' });
        await loadProfiles();
        setImportedHubIds(prev => new Set([...prev, user.user_id]));
      } else {
        setHubMessage({ type: 'error', text: isUpdate ? 'Failed to update user' : 'Failed to import user' });
      }
    } catch (error) {
      console.error('Error importing user:', error);
      setHubMessage({ type: 'error', text: 'Failed to import user' });
    } finally {
      setImporting(null);
    }
  }

  async function handleRoleChange(profileId: string, userId: string | null, newRole: string) {
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', profileId);

      if (profileError) throw profileError;

      if (userId) {
        await supabase.from('user_roles').upsert({ user_id: userId, role: newRole }, { onConflict: 'user_id' });
      }

      setToast({ message: 'Role updated successfully', type: 'success' });
      await loadProfiles();
    } catch (error) {
      console.error('Error updating role:', error);
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
      setToast({ message: 'Name updated successfully', type: 'success' });
      setEditingId(null);
      await loadProfiles();
    } catch (error) {
      console.error('Error updating name:', error);
      setToast({ message: 'Failed to update name', type: 'error' });
    }
  }

  async function handleDelete(profile: Profile) {
    setDeletingId(profile.id);
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', profile.id);

      if (error) throw error;
      setToast({ message: 'User deleted successfully', type: 'success' });
      setDeletingId(null);
      await loadProfiles();
    } catch (error) {
      console.error('Error deleting profile:', error);
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
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <div>
        <h1 className="text-4xl font-heading font-bold text-gray-800 dark:text-white mb-2">User Management</h1>
        <p className="text-gray-600 dark:text-gray-400 text-lg">Manage user roles and permissions</p>
      </div>

      {/* Local users */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="bg-gradient-to-r from-[#5A4E6B] to-[#6B5D7B] dark:from-[#4A3E5B] dark:to-[#5B4D6B] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-lg p-2">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white">Lab Users</h3>
          </div>
        </div>

        <div className="p-6">
          {loading && profiles.length === 0 ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#fdda36] mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading users...</p>
            </div>
          ) : profiles.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400">No users found</p>
            </div>
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
                          <span className="text-gray-900 dark:text-white font-medium">{profile.full_name || 'No name'}</span>
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

      {/* Import from HUB */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="bg-gradient-to-r from-[#5A4E6B] to-[#6B5D7B] dark:from-[#4A3E5B] dark:to-[#5B4D6B] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 rounded-lg p-2">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Import from HUB</h2>
                <p className="text-white/70 text-sm">All HUB profiles — defaults to Coach role</p>
              </div>
            </div>
            <button
              onClick={loadHubProfiles}
              disabled={loadingHub}
              className="text-white/80 hover:text-white text-sm underline disabled:opacity-50"
            >
              {loadingHub ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="p-6">
          {hubMessage && (
            <div className={`mb-4 p-4 rounded-lg border-l-4 ${
              hubMessage.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 border-green-500 text-green-700 dark:text-green-300'
                : 'bg-red-50 dark:bg-red-900/20 border-red-500 text-red-700 dark:text-red-300'
            }`}>
              {hubMessage.text}
            </div>
          )}

          {loadingHub ? (
            <div className="text-center py-12 text-gray-600 dark:text-gray-400">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#fdda36] mx-auto mb-3"></div>
              Loading HUB profiles...
            </div>
          ) : hubProfiles.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <p className="text-gray-600 dark:text-gray-400">No profiles found in HUB</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                    <th className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-300">Name</th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-300">Email</th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-300">HUB Role</th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-300">Import As</th>
                    <th className="text-right py-4 px-4 font-semibold text-gray-700 dark:text-gray-300">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {hubProfiles.map((user) => {
                    const isImported = importedHubIds.has(user.user_id);
                    const isProcessing = importing === user.user_id;
                    const assignedRole = selectedRoles[user.user_id] ?? 'coach';

                    return (
                      <tr key={user.user_id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <td className="py-4 px-4 text-gray-900 dark:text-white font-medium">
                          {user.full_name || 'N/A'}
                        </td>
                        <td className="py-4 px-4 text-gray-600 dark:text-gray-400 text-sm">
                          {user.email || '—'}
                        </td>
                        <td className="py-4 px-4">
                          <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${roleBadgeClass(user.role)}`}>
                            {user.role.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <select
                            value={assignedRole}
                            onChange={(e) => setSelectedRoles(prev => ({ ...prev, [user.user_id]: e.target.value as UserRole }))}
                            className="px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm"
                          >
                            <option value="coach">Coach</option>
                            <option value="admin">Admin</option>
                            <option value="athlete">Athlete</option>
                          </select>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isImported && (
                              <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                Imported
                              </span>
                            )}
                            <button
                              onClick={() => handleImport(user)}
                              disabled={isProcessing || !user.email}
                              className={`px-4 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-md ${
                                isImported
                                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                                  : 'bg-[#fdda36] text-[#514163] hover:bg-[#fdda36]/90'
                              }`}
                            >
                              {isProcessing ? (isImported ? 'Updating...' : 'Importing...') : (isImported ? 'Update' : 'Import')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
