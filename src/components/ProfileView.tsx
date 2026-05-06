import { useAuth } from '../contexts/AuthContext';

export default function ProfileView() {
  const { user, profile } = useAuth();

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-heading text-gray-900 dark:text-white mb-4">
          My Profile
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Full Name
            </label>
            <p className="text-gray-900 dark:text-white font-body">
              {profile?.full_name || 'Not set'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <p className="text-gray-900 dark:text-white font-body">
              {user?.email}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Role (Local)
            </label>
            <p className="text-gray-900 dark:text-white font-body capitalize">
              {profile?.role}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Role (HUB)
            </label>
            <p className="text-gray-900 dark:text-white font-body capitalize">
              {user?.role}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Active Plans
            </label>
            <div className="flex gap-2 flex-wrap">
              {user?.active_plan && user.active_plan.length > 0 ? (
                user.active_plan.map((plan) => (
                  <span key={plan} className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm">
                    {plan}
                  </span>
                ))
              ) : (
                <span className="text-gray-500 dark:text-gray-400">No active plans</span>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              HUB User ID
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              {user?.id}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Local Profile ID
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              {profile?.id}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
