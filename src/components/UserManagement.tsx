import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getHubAdminsAndCoaches, getHubAthletes, importAdminOrCoachFromHub, importAthleteFromHub, checkImportedAthletes, checkImportedAdminsAndCoaches, HubProfile } from '../lib/auth';
import Toast from './Toast';

interface Profile {
  id: string;
  full_name: string | null;
  role: string;
  user_id: string;
}

interface ToastMessage {
  message: string;
  type: 'success' | 'error';
}

export default function UserManagement() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [hubUsers, setHubUsers] = useState<HubProfile[]>([]);
  const [hubAthletes, setHubAthletes] = useState<HubProfile[]>([]);
  const [importedAthletes, setImportedAthletes] = useState<Set<string>>(new Set());
  const [importedAdminsAndCoaches, setImportedAdminsAndCoaches] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadingHubUsers, setLoadingHubUsers] = useState(false);
  const [loadingAthletes, setLoadingAthletes] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [importingAthlete, setImportingAthlete] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [hubMessage, setHubMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [athleteMessage, setAthleteMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadProfiles();
    loadHubUsers();
    loadHubAthletes();
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

  async function loadHubUsers() {
    setLoadingHubUsers(true);
    setHubMessage(null);

    const hubUrl = import.meta.env.VITE_HUB_SUPABASE_URL;
    const hubKey = import.meta.env.VITE_HUB_SUPABASE_ANON_KEY;

    if (!hubUrl || !hubKey) {
      setHubMessage({
        type: 'error',
        text: 'HUB not configured. Please set VITE_HUB_SUPABASE_URL and VITE_HUB_SUPABASE_ANON_KEY in .env file.'
      });
      setLoadingHubUsers(false);
      return;
    }

    try {
      const users = await getHubAdminsAndCoaches();

      if (users.length === 0) {
        setHubMessage({
          type: 'error',
          text: 'No admin or coach users found in HUB.'
        });
        setHubUsers([]);
        setLoadingHubUsers(false);
        return;
      }

      setHubUsers(users);

      const hubUserIds = users.map(u => u.user_id);
      const imported = await checkImportedAdminsAndCoaches(hubUserIds);
      setImportedAdminsAndCoaches(imported);
    } catch (error) {
      console.error('Error loading HUB users:', error);
      setHubMessage({ type: 'error', text: 'Failed to load HUB users. Check console for details.' });
    } finally {
      setLoadingHubUsers(false);
    }
  }

  async function loadHubAthletes() {
    setLoadingAthletes(true);
    setAthleteMessage(null);

    const hubUrl = import.meta.env.VITE_HUB_SUPABASE_URL;
    const hubKey = import.meta.env.VITE_HUB_SUPABASE_ANON_KEY;

    if (!hubUrl || !hubKey) {
      setAthleteMessage({
        type: 'error',
        text: 'HUB not configured.'
      });
      setLoadingAthletes(false);
      return;
    }

    try {
      const athletes = await getHubAthletes();

      if (athletes.length === 0) {
        setAthleteMessage({
          type: 'error',
          text: 'No athletes found in HUB.'
        });
        setHubAthletes([]);
        setLoadingAthletes(false);
        return;
      }

      setHubAthletes(athletes);

      const imported = await checkImportedAthletes(athletes.map(a => a.user_id));
      setImportedAthletes(imported);
    } catch (error) {
      console.error('Error loading HUB athletes:', error);
      setAthleteMessage({ type: 'error', text: 'Failed to load HUB athletes.' });
    } finally {
      setLoadingAthletes(false);
    }
  }

  async function handleImport(userId: string, email: string, isUpdate: boolean) {
    setImporting(userId);
    setHubMessage(null);
    try {
      const success = await importAdminOrCoachFromHub(userId, email);
      if (success) {
        const message = isUpdate ? 'User updated successfully' : 'User imported successfully';
        setHubMessage({ type: 'success', text: message });
        await loadProfiles();

        const updatedImported = new Set(importedAdminsAndCoaches);
        updatedImported.add(userId);
        setImportedAdminsAndCoaches(updatedImported);
      } else {
        const message = isUpdate ? 'Failed to update user' : 'Failed to import user';
        setHubMessage({ type: 'error', text: message });
      }
    } catch (error) {
      console.error('Error importing user:', error);
      const message = isUpdate ? 'Failed to update user' : 'Failed to import user';
      setHubMessage({ type: 'error', text: message });
    } finally {
      setImporting(null);
    }
  }

  async function handleImportAthlete(userId: string, email: string, fullName: string, isUpdate: boolean) {
    setImportingAthlete(userId);
    setAthleteMessage(null);
    try {
      const success = await importAthleteFromHub(userId, email, fullName);
      if (success) {
        const message = isUpdate ? 'Athlete updated successfully' : 'Athlete imported successfully';
        setAthleteMessage({ type: 'success', text: message });

        const updatedImported = new Set(importedAthletes);
        updatedImported.add(userId);
        setImportedAthletes(updatedImported);
      } else {
        const message = isUpdate ? 'Failed to update athlete' : 'Failed to import athlete';
        setAthleteMessage({ type: 'error', text: message });
      }
    } catch (error) {
      console.error('Error importing athlete:', error);
      const message = isUpdate ? 'Failed to update athlete' : 'Failed to import athlete';
      setAthleteMessage({ type: 'error', text: message });
    } finally {
      setImportingAthlete(null);
    }
  }

  async function handleRoleChange(profileId: string, userId: string, newRole: string) {
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', profileId);

      if (profileError) throw profileError;

      const { error: rolesError } = await supabase
        .from('user_roles')
        .upsert({
          user_id: userId,
          role: newRole
        }, {
          onConflict: 'user_id'
        });

      if (rolesError) throw rolesError;

      setToast({ message: 'Role updated successfully', type: 'success' });
      await loadProfiles();
    } catch (error) {
      console.error('Error updating role:', error);
      setToast({ message: 'Failed to update role', type: 'error' });
    }
  }

  return (
    <div className="space-y-8">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div>
        <h1 className="text-4xl font-heading font-bold text-gray-800 dark:text-white mb-2">
          User Management
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-lg">
          Manage user roles and permissions
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="bg-gradient-to-r from-[#5A4E6B] to-[#6B5D7B] dark:from-[#4A3E5B] dark:to-[#5B4D6B] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-lg p-2">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white">All Users</h3>
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
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((profile) => (
                    <tr
                      key={profile.id}
                      className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <td className="py-4 px-4 text-gray-900 dark:text-white font-medium">
                        {profile.full_name || 'No name'}
                      </td>
                      <td className="py-4 px-4 text-gray-600 dark:text-gray-400 font-mono text-xs">
                        {profile.user_id.substring(0, 8)}...
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="bg-gradient-to-r from-[#5A4E6B] to-[#6B5D7B] dark:from-[#4A3E5B] dark:to-[#5B4D6B] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-lg p-2">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white">Import HUB Users (Admin/Coach)</h2>
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

          {loadingHubUsers ? (
            <div className="text-center py-12 text-gray-600 dark:text-gray-400">
              Loading HUB users...
            </div>
          ) : hubUsers.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <p className="text-gray-600 dark:text-gray-400">
                No admin or coach users found in HUB
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                    <th className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-300">Name</th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-300">Email</th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-300">Role</th>
                    <th className="text-right py-4 px-4 font-semibold text-gray-700 dark:text-gray-300">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {hubUsers.map((user) => {
                    const isImported = importedAdminsAndCoaches.has(user.user_id);
                    const isProcessing = importing === user.user_id;

                    return (
                      <tr key={user.user_id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <td className="py-4 px-4 text-gray-900 dark:text-white font-medium">
                          {user.full_name || 'N/A'}
                        </td>
                        <td className="py-4 px-4 text-gray-600 dark:text-gray-400">
                          {user.email}
                        </td>
                        <td className="py-4 px-4">
                          <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                            user.role === 'admin'
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                          }`}>
                            {user.role.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isImported && (
                              <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                Imported
                              </span>
                            )}
                            <button
                              onClick={() => user.email && handleImport(user.user_id, user.email, isImported)}
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

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="bg-gradient-to-r from-[#5A4E6B] to-[#6B5D7B] dark:from-[#4A3E5B] dark:to-[#5B4D6B] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-lg p-2">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white">Import HUB Athletes</h2>
          </div>
        </div>

        <div className="p-6">
          {athleteMessage && (
            <div className={`mb-4 p-4 rounded-lg border-l-4 ${
              athleteMessage.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 border-green-500 text-green-700 dark:text-green-300'
                : 'bg-red-50 dark:bg-red-900/20 border-red-500 text-red-700 dark:text-red-300'
            }`}>
              {athleteMessage.text}
            </div>
          )}

          {loadingAthletes ? (
            <div className="text-center py-12 text-gray-600 dark:text-gray-400">
              Loading HUB athletes...
            </div>
          ) : hubAthletes.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <p className="text-gray-600 dark:text-gray-400">
                No athletes found in HUB
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                    <th className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-300">Name</th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-300">Email</th>
                    <th className="text-right py-4 px-4 font-semibold text-gray-700 dark:text-gray-300">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {hubAthletes.map((athlete) => {
                    const isImported = importedAthletes.has(athlete.user_id);
                    const isProcessing = importingAthlete === athlete.user_id;

                    return (
                      <tr key={athlete.user_id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <td className="py-4 px-4 text-gray-900 dark:text-white font-medium">
                          {athlete.full_name || 'N/A'}
                        </td>
                        <td className="py-4 px-4 text-gray-600 dark:text-gray-400">
                          {athlete.email}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isImported && (
                              <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                Imported
                              </span>
                            )}
                            <button
                              onClick={() => athlete.email && handleImportAthlete(athlete.user_id, athlete.email, athlete.full_name || '', isImported)}
                              disabled={isProcessing || !athlete.email}
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
