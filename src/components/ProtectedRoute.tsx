import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import LocalProfileSelector from './LocalProfileSelector';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const USE_LOCAL_AUTH = import.meta.env.VITE_USE_LOCAL_AUTH === 'true';

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, profile, loading, selectProfile } = useAuth();

  useEffect(() => {
    if (!loading && !user && !USE_LOCAL_AUTH) {
      window.location.replace('/');
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400 text-lg font-body">Loading...</div>
      </div>
    );
  }

  if (!user && USE_LOCAL_AUTH) {
    return <LocalProfileSelector onSelectProfile={selectProfile} />;
  }

  if (!user) {
    return null;
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-2xl border border-gray-200 dark:border-gray-700">
          <div className="mb-4 text-center">
            <svg className="w-16 h-16 mx-auto text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-heading text-gray-900 dark:text-white mb-2 text-center">
            No Local Profile Found
          </h2>
          <p className="text-gray-600 dark:text-gray-400 font-body mb-6 text-center">
            Your account is authenticated but no local profile exists in this application.
          </p>

          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              HUB User Info:
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Email:</span>
                <span className="text-gray-900 dark:text-white font-mono text-xs">{user.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">User ID:</span>
                <span className="text-gray-900 dark:text-white font-mono text-xs">{user.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">HUB Role:</span>
                <span className="text-gray-900 dark:text-white capitalize">{user.role}</span>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
              To create your profile, run this SQL:
            </h3>
            <pre className="bg-white dark:bg-gray-950 rounded p-3 text-xs overflow-x-auto border border-blue-100 dark:border-blue-900">
              <code className="text-gray-800 dark:text-gray-200">
{`INSERT INTO profiles
  (hub_user_id, role, full_name)
VALUES
  ('${user.id}', 'coach', 'Your Name Here');`}
              </code>
            </pre>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-500 font-body text-center">
            Run the SQL above in your Supabase dashboard, then refresh this page.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
