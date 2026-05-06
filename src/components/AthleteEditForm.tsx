import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Athlete, Sport, Sex } from '../types';
import { Save, X } from 'lucide-react';

interface AthleteEditFormProps {
  athlete: Athlete;
  onCancel: () => void;
  onSuccess: (updated: Athlete) => void;
}

export default function AthleteEditForm({ athlete, onCancel, onSuccess }: AthleteEditFormProps) {
  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    sport: Sport | '';
    date_of_birth: string;
    sex: Sex | '';
  }>({
    name: athlete.name || '',
    email: (athlete as any).email || '',
    sport: (athlete.sport as Sport) || '',
    date_of_birth: athlete.date_of_birth || '',
    sex: (athlete.sex as Sex) || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('El nombre es requerido');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: updateError } = await supabase
        .from('athletes')
        .update({
          name: formData.name.trim(),
          email: formData.email.trim() || null,
          sport: formData.sport || 'other',
          date_of_birth: formData.date_of_birth || null,
          sex: formData.sex || null,
        })
        .eq('id', athlete.id)
        .select()
        .single();

      if (updateError) throw updateError;
      onSuccess(data as Athlete);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar el atleta');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50";
  const labelClass = "block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5";

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-gray-900 dark:text-white">Editar Atleta</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Modificar datos básicos del perfil de {athlete.name}.
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
            <label className={labelClass}>Nombre completo *</label>
            <input
              type="text"
              className={inputClass}
              value={formData.name}
              onChange={e => { setFormData(p => ({ ...p, name: e.target.value })); setError(null); }}
              placeholder="Nombre y apellido"
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
              placeholder="atleta@ejemplo.com"
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Fecha de nacimiento</label>
              <input
                type="date"
                className={inputClass}
                value={formData.date_of_birth}
                onChange={e => setFormData(p => ({ ...p, date_of_birth: e.target.value }))}
                disabled={loading}
              />
            </div>
            <div>
              <label className={labelClass}>Sexo biológico</label>
              <select
                className={inputClass}
                value={formData.sex}
                onChange={e => setFormData(p => ({ ...p, sex: e.target.value as Sex | '' }))}
                disabled={loading}
              >
                <option value="">No especificado</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="prefer_not_to_say">Prefiero no decir</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Deporte principal</label>
            <select
              className={inputClass}
              value={formData.sport}
              onChange={e => setFormData(p => ({ ...p, sport: e.target.value as Sport | '' }))}
              disabled={loading}
            >
              <option value="">No especificado</option>
              <option value="cycling">Ciclismo</option>
              <option value="running">Running</option>
              <option value="triathlon">Triatlón</option>
              <option value="swimming">Natación</option>
              <option value="other">Otros</option>
            </select>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !formData.name.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 text-sm font-semibold hover:bg-slate-700 dark:hover:bg-slate-300 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
