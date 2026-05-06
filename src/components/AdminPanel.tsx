import { useState, useEffect } from 'react';
import { getHubAdminsAndCoaches, getHubAthletes, importAdminOrCoachFromHub, importAthleteFromHub, HubProfile } from '../lib/auth';

export default function AdminPanel() {
  const [hubUsers, setHubUsers] = useState<HubProfile[]>([]);
  const [hubAthletes, setHubAthletes] = useState<HubProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingAthletes, setLoadingAthletes] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [importingAthlete, setImportingAthlete] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [athleteMessage, setAthleteMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadHubUsers();
    loadHubAthletes();
  }, []);

  async function loadHubUsers() {
    setLoading(true);
    setMessage(null);

    const hubUrl = import.meta.env.VITE_HUB_SUPABASE_URL;
    const hubKey = import.meta.env.VITE_HUB_SUPABASE_ANON_KEY;

    if (!hubUrl || !hubKey) {
      setMessage({
        type: 'error',
        text: 'HUB not configured. Please set VITE_HUB_SUPABASE_URL and VITE_HUB_SUPABASE_ANON_KEY in .env file.'
      });
      setLoading(false);
      return;
    }

    try {
      const users = await getHubAdminsAndCoaches();

      if (users.length === 0) {
        setMessage({
          type: 'error',
          text: 'No admin or coach users found in HUB. The HUB database may not have the same schema or RLS policies may be blocking access.'
        });
        setHubUsers([]);
        setLoading(false);
        return;
      }

      setHubUsers(users);
    } catch (error) {
      console.error('Error loading HUB users:', error);
      setMessage({ type: 'error', text: 'Failed to load HUB users. Check console for details.' });
    } finally {
      setLoading(false);
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
        text: 'HUB not configured. Please set VITE_HUB_SUPABASE_URL and VITE_HUB_SUPABASE_ANON_KEY in .env file.'
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
    } catch (error) {
      console.error('Error loading HUB athletes:', error);
      setAthleteMessage({ type: 'error', text: 'Failed to load HUB athletes. Check console for details.' });
    } finally {
      setLoadingAthletes(false);
    }
  }

  async function handleImport(userId: string, email: string) {
    setImporting(userId);
    setMessage(null);
    try {
      const success = await importAdminOrCoachFromHub(userId, email);
      if (success) {
        setMessage({ type: 'success', text: 'User imported successfully' });
      } else {
        setMessage({ type: 'error', text: 'Failed to import user' });
      }
    } catch (error) {
      console.error('Error importing user:', error);
      setMessage({ type: 'error', text: 'Failed to import user' });
    } finally {
      setImporting(null);
    }
  }

  async function handleImportAthlete(userId: string, email: string, fullName: string) {
    setImportingAthlete(userId);
    setAthleteMessage(null);
    try {
      const success = await importAthleteFromHub(userId, email, fullName);
      if (success) {
        setAthleteMessage({ type: 'success', text: 'Athlete imported successfully' });
      } else {
        setAthleteMessage({ type: 'error', text: 'Failed to import athlete' });
      }
    } catch (error) {
      console.error('Error importing athlete:', error);
      setAthleteMessage({ type: 'error', text: 'Failed to import athlete' });
    } finally {
      setImportingAthlete(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-heading font-bold text-gray-800 dark:text-white mb-2">
          Import HUB Users
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-lg">
          Import admin and coach users from Asciende HUB
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="bg-gradient-to-r from-[#5A4E6B] to-[#6B5D7B] dark:from-[#4A3E5B] dark:to-[#5B4D6B] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-lg p-2">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white">HUB Users</h2>
          </div>
        </div>

        <div className="p-6">
          {message && (
            <div className={`mb-4 p-4 rounded-lg border-l-4 ${
              message.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 border-green-500 text-green-700 dark:text-green-300'
                : 'bg-red-50 dark:bg-red-900/20 border-red-500 text-red-700 dark:text-red-300'
            }`}>
              {message.text}
            </div>
          )}

          {loading ? (
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
                  {hubUsers.map((user) => (
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
                        <button
                          onClick={() => user.email && handleImport(user.user_id, user.email)}
                          disabled={importing === user.user_id || !user.email}
                          className="px-4 py-2 bg-[#fdda36] text-[#514163] rounded-lg font-semibold hover:bg-[#fdda36]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-md"
                        >
                          {importing === user.user_id ? 'Importing...' : 'Import'}
                        </button>
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white">HUB Athletes</h2>
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
                  {hubAthletes.map((athlete) => (
                    <tr key={athlete.user_id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="py-4 px-4 text-gray-900 dark:text-white font-medium">
                        {athlete.full_name || 'N/A'}
                      </td>
                      <td className="py-4 px-4 text-gray-600 dark:text-gray-400">
                        {athlete.email}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={() => athlete.email && handleImportAthlete(athlete.user_id, athlete.email, athlete.full_name || '')}
                          disabled={importingAthlete === athlete.user_id || !athlete.email}
                          className="px-4 py-2 bg-[#fdda36] text-[#514163] rounded-lg font-semibold hover:bg-[#fdda36]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-md"
                        >
                          {importingAthlete === athlete.user_id ? 'Importing...' : 'Import'}
                        </button>
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
