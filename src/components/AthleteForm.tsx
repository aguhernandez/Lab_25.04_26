import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Sport, Sex } from '../types';
import { UserPlus, Info } from 'lucide-react';

interface AthleteFormProps {
  onCancel: () => void;
  onSuccess: () => void;
}

export default function AthleteForm({ onCancel, onSuccess }: AthleteFormProps) {
  const { profile } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    sport: '' as Sport | '',
    date_of_birth: '',
    sex: '' as Sex | '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.from('athletes').insert([{
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        sport: formData.sport || 'other',
        date_of_birth: formData.date_of_birth || null,
        sex: formData.sex || null,
        coach_id: profile?.id || null,
      }]);
      if (error) throw error;
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create athlete');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50";
  const labelClass = "block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5";

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-gray-900 dark:text-white">Create Athlete Profile</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Basic information to register an athlete in the Lab.
        </p>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex gap-3">
        <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Weight, height and body composition will come from Anthropometry results once a measurement is completed.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-600 dark:text-red-400 mb-5">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className={labelClass}>Full Name *</label>
            <input
              type="text"
              className={inputClass}
              value={formData.name}
              onChange={e => { setFormData(p => ({ ...p, name: e.target.value })); setError(null); }}
              placeholder="First and last name"
              disabled={loading}
            />
          </div>

          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              className={inputClass}
              value={formData.email}
              onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
              placeholder="athlete@example.com"
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Date of Birth</label>
              <input
                type="date"
                className={inputClass}
                value={formData.date_of_birth}
                onChange={e => setFormData(p => ({ ...p, date_of_birth: e.target.value }))}
                disabled={loading}
              />
            </div>
            <div>
              <label className={labelClass}>Biological Sex</label>
              <select
                className={inputClass}
                value={formData.sex}
                onChange={e => setFormData(p => ({ ...p, sex: e.target.value as Sex | '' }))}
                disabled={loading}
              >
                <option value="">Not specified</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Primary Sport</label>
            <select
              className={inputClass}
              value={formData.sport}
              onChange={e => setFormData(p => ({ ...p, sport: e.target.value as Sport | '' }))}
              disabled={loading}
            >
              <option value="">Not specified</option>
              <option value="cycling">Cycling</option>
              <option value="running">Running</option>
              <option value="triathlon">Triathlon</option>
              <option value="swimming">Swimming</option>
              <option value="other">Otros</option>
            </select>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.name.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 text-sm font-semibold hover:bg-slate-700 dark:hover:bg-slate-300 transition-colors disabled:opacity-50"
            >
              <UserPlus className="w-4 h-4" />
              {loading ? 'Creating...' : 'Create Athlete'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
