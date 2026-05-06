import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface LocalProfileSelectorProps {
  onSelectProfile: (profileId: string) => void;
}

type ProfileRole = 'athlete' | 'coach' | 'admin';

interface RoleOption {
  role: ProfileRole;
  title: string;
  description: string;
  icon: JSX.Element;
  bgColor: string;
  iconColor: string;
}

export default function LocalProfileSelector({ onSelectProfile }: LocalProfileSelectorProps) {
  const [creating, setCreating] = useState(false);
  const [selectedRole, setSelectedRole] = useState<ProfileRole | null>(null);

  const roleOptions: RoleOption[] = [
    {
      role: 'athlete',
      title: 'Athlete',
      description: 'View sessions and track performance',
      bgColor: 'bg-blue-100',
      iconColor: 'text-blue-600',
      icon: (
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      role: 'coach',
      title: 'Coach',
      description: 'Create and manage training sessions',
      bgColor: 'bg-green-100',
      iconColor: 'text-green-600',
      icon: (
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      role: 'admin',
      title: 'Admin',
      description: 'Full system management access',
      bgColor: 'bg-purple-100',
      iconColor: 'text-purple-600',
      icon: (
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
  ];

  async function handleRoleSelect(role: ProfileRole) {
    setSelectedRole(role);
    setCreating(true);

    try {
      const defaultName = `Dev ${role.charAt(0).toUpperCase() + role.slice(1)}`;

      const userId = crypto.randomUUID();

      const { data, error } = await supabase
        .from('profiles')
        .insert({
          user_id: userId,
          role,
          full_name: defaultName,
          hub_user_id: null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating profile:', error);
        setCreating(false);
        setSelectedRole(null);
        return;
      }

      if (data) {
        onSelectProfile(data.id);
      }
    } catch (error) {
      console.error('Error creating profile:', error);
      setCreating(false);
      setSelectedRole(null);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-700 via-slate-600 to-slate-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-12 max-w-4xl w-full">
        {/* Header with Icon */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-yellow-200 to-yellow-300 rounded-full flex items-center justify-center shadow-lg">
            <svg className="w-10 h-10 text-yellow-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">
            Local Development Mode
          </h2>
          <p className="text-gray-600 text-lg">
            Select a profile type to continue development
          </p>
        </div>

        {/* Role Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {roleOptions.map((option) => (
            <button
              key={option.role}
              onClick={() => handleRoleSelect(option.role)}
              disabled={creating}
              className={`
                relative p-8 rounded-xl border-2 border-gray-200
                hover:border-gray-300 hover:shadow-lg
                transition-all duration-200 text-center
                ${creating && selectedRole === option.role ? 'opacity-50 cursor-not-allowed' : ''}
                ${creating && selectedRole !== option.role ? 'opacity-30 cursor-not-allowed' : ''}
              `}
            >
              <div className={`w-16 h-16 mx-auto mb-4 ${option.bgColor} rounded-full flex items-center justify-center`}>
                <div className={option.iconColor}>
                  {option.icon}
                </div>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {option.title}
              </h3>
              <p className="text-sm text-gray-600">
                {option.description}
              </p>
              {creating && selectedRole === option.role && (
                <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 rounded-xl">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Warning Note */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm text-yellow-800">
                <strong className="font-semibold">Note:</strong> This mode is for local development only. In production, authentication will be handled by the HUB.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
