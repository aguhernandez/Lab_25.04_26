import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { SPORT_LABELS, LEVEL_LABELS, LEVEL_ORDER, POPULATION_CATEGORY_LABELS, Sport, CompetitiveLevel, Sex, PopulationCategory, VO2_REFERENCES, ANTHRO_REFERENCES } from '../lib/referencePopulations';

type Tab = 'vo2' | 'anthro';

interface CustomVO2 {
  id: string;
  sport: string;
  sport_label: string;
  level: string;
  level_label: string;
  population_category: PopulationCategory;
  sex: string;
  vo2max_mean: number;
  vo2max_sd: number | null;
  vo2max_min: number;
  vo2max_max: number;
  lactate_lt1_vo2_percent: number | null;
  lactate_lt2_vo2_percent: number | null;
  population: string;
  citation: string;
  citation_short: string;
  year: number | null;
  notes: string | null;
}

interface CustomAnthro {
  id: string;
  sport: string;
  sport_label: string;
  level: string;
  level_label: string;
  population_category: PopulationCategory;
  sex: string;
  body_fat_mean: number | null;
  body_fat_sd: number | null;
  body_fat_min: number | null;
  body_fat_max: number | null;
  muscle_mass_percent_mean: number | null;
  muscle_mass_percent_sd: number | null;
  measurement_protocol: string | null;
  sum_6_skinfolds_mean: number | null;
  sum_6_skinfolds_sd: number | null;
  sum_6_skinfolds_min: number | null;
  sum_6_skinfolds_max: number | null;
  muscle_bone_ratio_mean: number | null;
  muscle_bone_ratio_sd: number | null;
  population: string;
  citation: string;
  citation_short: string;
  year: number | null;
  notes: string | null;
}

const EMPTY_VO2: Omit<CustomVO2, 'id'> = {
  sport: 'cycling_road',
  sport_label: 'Ciclismo en Ruta',
  level: 'national',
  level_label: 'Nivel Nacional',
  population_category: 'amateur',
  sex: 'male',
  vo2max_mean: 0,
  vo2max_sd: null,
  vo2max_min: 0,
  vo2max_max: 0,
  lactate_lt1_vo2_percent: null,
  lactate_lt2_vo2_percent: null,
  population: '',
  citation: '',
  citation_short: '',
  year: null,
  notes: null,
};

const EMPTY_ANTHRO: Omit<CustomAnthro, 'id'> = {
  sport: 'cycling_road',
  sport_label: 'Ciclismo en Ruta',
  level: 'national',
  level_label: 'Nivel Nacional',
  population_category: 'amateur',
  sex: 'male',
  body_fat_mean: null,
  body_fat_sd: null,
  body_fat_min: null,
  body_fat_max: null,
  muscle_mass_percent_mean: null,
  muscle_mass_percent_sd: null,
  measurement_protocol: 'ISAK',
  sum_6_skinfolds_mean: null,
  sum_6_skinfolds_sd: null,
  sum_6_skinfolds_min: null,
  sum_6_skinfolds_max: null,
  muscle_bone_ratio_mean: null,
  muscle_bone_ratio_sd: null,
  population: '',
  citation: '',
  citation_short: '',
  year: null,
  notes: null,
};

export default function ReferencePopulationsAdmin() {
  const [tab, setTab] = useState<Tab>('vo2');
  const [vo2List, setVO2List] = useState<CustomVO2[]>([]);
  const [anthroList, setAnthroList] = useState<CustomAnthro[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formVO2, setFormVO2] = useState<Omit<CustomVO2, 'id'>>(EMPTY_VO2);
  const [formAnthro, setFormAnthro] = useState<Omit<CustomAnthro, 'id'>>(EMPTY_ANTHRO);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [builtInHidden, setBuiltInHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [{ data: vo2 }, { data: anthro }] = await Promise.all([
      supabase.from('custom_vo2_references').select('*').order('created_at', { ascending: false }),
      supabase.from('custom_anthro_references').select('*').order('created_at', { ascending: false }),
    ]);
    setVO2List(vo2 || []);
    setAnthroList(anthro || []);
  };

  const handleSportChange = (sport: string) => {
    const label = SPORT_LABELS[sport as Sport] || sport;
    if (tab === 'vo2') {
      setFormVO2(f => ({ ...f, sport, sport_label: label }));
    } else {
      setFormAnthro(f => ({ ...f, sport, sport_label: label }));
    }
  };

  const handleLevelChange = (level: string) => {
    const label = LEVEL_LABELS[level as CompetitiveLevel] || level;
    if (tab === 'vo2') {
      setFormVO2(f => ({ ...f, level, level_label: label }));
    } else {
      setFormAnthro(f => ({ ...f, level, level_label: label }));
    }
  };

  const handleSubmitVO2 = async () => {
    setError('');
    if (!formVO2.sport || !formVO2.level || !formVO2.vo2max_mean || !formVO2.population) {
      setError('Sport, level, VO2max mean, and population are required.');
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await supabase.from('custom_vo2_references').update(formVO2).eq('id', editId);
      } else {
        await supabase.from('custom_vo2_references').insert(formVO2);
      }
      setShowForm(false);
      setEditId(null);
      setFormVO2(EMPTY_VO2);
      await loadData();
    } catch (e) {
      setError('Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitAnthro = async () => {
    setError('');
    if (!formAnthro.sport || !formAnthro.level || !formAnthro.population) {
      setError('Sport, level, and population are required.');
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await supabase.from('custom_anthro_references').update(formAnthro).eq('id', editId);
      } else {
        await supabase.from('custom_anthro_references').insert(formAnthro);
      }
      setShowForm(false);
      setEditId(null);
      setFormAnthro(EMPTY_ANTHRO);
      await loadData();
    } catch (e) {
      setError('Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, isBuiltIn: boolean) => {
    if (isBuiltIn) {
      setBuiltInHidden(prev => new Set([...prev, id]));
      setDeleteConfirm(null);
    } else {
      const table = tab === 'vo2' ? 'custom_vo2_references' : 'custom_anthro_references';
      await supabase.from(table).delete().eq('id', id);
      await loadData();
      setDeleteConfirm(null);
    }
  };

  const handleEdit = (item: CustomVO2 | CustomAnthro) => {
    setEditId(item.id);
    if (tab === 'vo2') {
      const v = item as CustomVO2;
      setFormVO2({ sport: v.sport, sport_label: v.sport_label, level: v.level, level_label: v.level_label, population_category: v.population_category ?? 'amateur', sex: v.sex, vo2max_mean: v.vo2max_mean, vo2max_sd: v.vo2max_sd, vo2max_min: v.vo2max_min, vo2max_max: v.vo2max_max, lactate_lt1_vo2_percent: v.lactate_lt1_vo2_percent, lactate_lt2_vo2_percent: v.lactate_lt2_vo2_percent, population: v.population, citation: v.citation, citation_short: v.citation_short, year: v.year, notes: v.notes });
    } else {
      const a = item as CustomAnthro;
      setFormAnthro({ sport: a.sport, sport_label: a.sport_label, level: a.level, level_label: a.level_label, population_category: a.population_category ?? 'amateur', sex: a.sex, body_fat_mean: a.body_fat_mean, body_fat_sd: a.body_fat_sd, body_fat_min: a.body_fat_min, body_fat_max: a.body_fat_max, muscle_mass_percent_mean: a.muscle_mass_percent_mean, muscle_mass_percent_sd: a.muscle_mass_percent_sd, measurement_protocol: a.measurement_protocol, sum_6_skinfolds_mean: a.sum_6_skinfolds_mean, sum_6_skinfolds_sd: a.sum_6_skinfolds_sd, sum_6_skinfolds_min: a.sum_6_skinfolds_min, sum_6_skinfolds_max: a.sum_6_skinfolds_max, muscle_bone_ratio_mean: a.muscle_bone_ratio_mean, muscle_bone_ratio_sd: a.muscle_bone_ratio_sd, population: a.population, citation: a.citation, citation_short: a.citation_short, year: a.year, notes: a.notes });
    }
    setShowForm(true);
  };

  const num = (v: string) => v === '' ? null : parseFloat(v);

  const currentList = tab === 'vo2' ? vo2List : anthroList;
  const builtInList = tab === 'vo2' ? VO2_REFERENCES : ANTHRO_REFERENCES;

  const ReferenceItem = ({ item, isBuiltIn }: { item: CustomVO2 | CustomAnthro | any; isBuiltIn: boolean }) => (
    <div className={`flex items-start gap-3 p-4 rounded-xl ${isBuiltIn ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30' : 'bg-gray-50 dark:bg-gray-700/40'}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">{item.sport_label}</span>
          <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded-full">{item.level_label}</span>
          <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs rounded-full">{item.sex === 'male' ? 'Masculino' : 'Femenino'}</span>
          {item.population_category && (
            <span className="px-2 py-0.5 bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 text-xs rounded-full">
              {POPULATION_CATEGORY_LABELS[item.population_category as PopulationCategory] ?? item.population_category}
            </span>
          )}
          {isBuiltIn && (
            <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs rounded-full font-semibold">Integrado</span>
          )}
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{item.population}</p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">{item.citation_short} {item.year ? `(${item.year})` : ''}</p>
        {item.notes && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 italic">{item.notes}</p>}
        {'vo2max_mean' in item && (
          <div className="text-xs font-medium text-blue-700 dark:text-blue-400 mt-2 space-y-1">
            <p>VO2max: {item.vo2max_mean} mL/kg/min (rango: {item.vo2max_min}–{item.vo2max_max})</p>
            {item.lactate_lt1_vo2_percent && <p>LT1: {item.lactate_lt1_vo2_percent}% VO2max</p>}
            {item.lactate_lt2_vo2_percent && <p>LT2: {item.lactate_lt2_vo2_percent}% VO2max</p>}
          </div>
        )}
        {'body_fat_mean' in item && (
          <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mt-2 space-y-1">
            {item.measurement_protocol && <p>Protocolo: {item.measurement_protocol}</p>}
            {item.body_fat_mean != null && <p>% Graso: {item.body_fat_mean}% {item.body_fat_sd ? `(±${item.body_fat_sd})` : ''}</p>}
            {item.muscle_mass_percent_mean != null && <p>% Muscular: {item.muscle_mass_percent_mean}% {item.muscle_mass_percent_sd ? `(±${item.muscle_mass_percent_sd})` : ''}</p>}
            {item.sum_6_skinfolds_mean != null && <p>Σ6 Pliegues: {item.sum_6_skinfolds_mean} mm {item.sum_6_skinfolds_sd ? `(±${item.sum_6_skinfolds_sd})` : ''}  {item.sum_6_skinfolds_min && item.sum_6_skinfolds_max ? `[${item.sum_6_skinfolds_min}–${item.sum_6_skinfolds_max}]` : ''}</p>}
            {item.muscle_bone_ratio_mean != null && <p>Índice Músculo-Óseo: {item.muscle_bone_ratio_mean.toFixed(2)}</p>}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {!isBuiltIn && (
          <button onClick={() => handleEdit(item)} className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors" title="Edit">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}
        <button
          onClick={() => setDeleteConfirm({ id: item.id, name: `${item.sport_label} - ${item.level_label} (${item.sex})` })}
          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
          title={isBuiltIn ? "Hide this reference" : "Delete this reference"}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 rounded-lg p-2.5">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Gestor de Poblaciones de Referencia</h2>
                <p className="text-xs text-white/70 mt-0.5">Ver referencias integradas y gestionar poblaciones personalizadas</p>
              </div>
            </div>
            <button
              onClick={() => { setShowForm(true); setEditId(null); setFormVO2(EMPTY_VO2); setFormAnthro(EMPTY_ANTHRO); }}
              className="flex items-center gap-2 px-4 py-2 bg-[#fdda36] text-slate-800 rounded-xl font-semibold text-sm hover:bg-[#fdda36]/90 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Agregar Población Personalizada
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3">
            <p className="text-xs text-blue-700 dark:text-blue-400">
              Las referencias integradas provienen de literatura científica revisada por pares. Se pueden agregar poblaciones personalizadas para complementar con datos institucionales o específicos del deporte.
            </p>
          </div>

          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex gap-1">
              {(['vo2', 'anthro'] as Tab[]).map(t => {
                const customCount = t === 'vo2' ? vo2List.length : anthroList.length;
                const totalCount = (t === 'vo2' ? VO2_REFERENCES : ANTHRO_REFERENCES).length + customCount;
                return (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-4 py-3 text-sm font-medium transition-colors ${
                      tab === t ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {t === 'vo2' ? 'Referencias VO2max' : 'Referencias Antropométricas'}
                    <span className="ml-2 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs">
                      {totalCount} ({customCount} personaliz.)
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            {builtInList.filter(item => !builtInHidden.has(item.id)).length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-300 mb-3">Referencias Científicas Integradas</h3>
                <div className="space-y-3">
                  {builtInList.filter(item => !builtInHidden.has(item.id)).map((item) => (
                    <ReferenceItem key={item.id} item={item} isBuiltIn={true} />
                  ))}
                </div>
              </div>
            )}

            {currentList.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Poblaciones Personalizadas</h3>
                <div className="space-y-3">
                  {currentList.map((item) => (
                    <ReferenceItem key={item.id} item={item} isBuiltIn={false} />
                  ))}
                </div>
              </div>
            )}

            {currentList.length === 0 && builtInList.length === 0 && (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">📊</div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">No hay poblaciones disponibles</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Agrega tu primera población de referencia personalizada.</p>
              </div>
            )}

            {currentList.length === 0 && builtInList.length > 0 && (
              <div className="text-center py-4 text-xs text-gray-500 dark:text-gray-400">
                Solo hay referencias integradas disponibles. Agrega poblaciones personalizadas para enriquecer las comparaciones.
              </div>
            )}
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl my-8">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                {editId ? 'Editar' : 'Agregar'} Referencia de {tab === 'vo2' ? 'VO2max' : 'Antropometría'}
              </h3>
              <button onClick={() => { setShowForm(false); setEditId(null); }} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Deporte</label>
                  <select
                    value={tab === 'vo2' ? formVO2.sport : formAnthro.sport}
                    onChange={e => handleSportChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(SPORT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Nivel Competitivo</label>
                  <select
                    value={tab === 'vo2' ? formVO2.level : formAnthro.level}
                    onChange={e => handleLevelChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {LEVEL_ORDER.map(l => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Categoría de Población</label>
                  <select
                    value={tab === 'vo2' ? formVO2.population_category : formAnthro.population_category}
                    onChange={e => {
                      const population_category = e.target.value as PopulationCategory;
                      if (tab === 'vo2') setFormVO2(f => ({ ...f, population_category }));
                      else setFormAnthro(f => ({ ...f, population_category }));
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(POPULATION_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Sexo</label>
                  <select
                    value={tab === 'vo2' ? formVO2.sex : formAnthro.sex}
                    onChange={e => {
                      const sex = e.target.value as Sex;
                      if (tab === 'vo2') setFormVO2(f => ({ ...f, sex }));
                      else setFormAnthro(f => ({ ...f, sex }));
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="male">Masculino</option>
                    <option value="female">Femenino</option>
                  </select>
                </div>
              </div>

              {tab === 'vo2' ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">Fisiología - VO2max</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Media (mL/kg/min) *</label>
                        <input type="number" step="0.1" value={formVO2.vo2max_mean || ''} onChange={e => setFormVO2(f => ({ ...f, vo2max_mean: parseFloat(e.target.value) || 0 }))} className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">SD</label>
                        <input type="number" step="0.1" value={formVO2.vo2max_sd ?? ''} onChange={e => setFormVO2(f => ({ ...f, vo2max_sd: num(e.target.value) }))} className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Min *</label>
                        <input type="number" step="0.1" value={formVO2.vo2max_min || ''} onChange={e => setFormVO2(f => ({ ...f, vo2max_min: parseFloat(e.target.value) || 0 }))} className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Max *</label>
                        <input type="number" step="0.1" value={formVO2.vo2max_max || ''} onChange={e => setFormVO2(f => ({ ...f, vo2max_max: parseFloat(e.target.value) || 0 }))} className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">Umbrales de Lactato</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">LT1 Intensidad (% VO2max)</label>
                        <input type="number" step="0.1" value={formVO2.lactate_lt1_vo2_percent ?? ''} onChange={e => setFormVO2(f => ({ ...f, lactate_lt1_vo2_percent: num(e.target.value) }))} className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">LT2 Intensidad (% VO2max)</label>
                        <input type="number" step="0.1" value={formVO2.lactate_lt2_vo2_percent ?? ''} onChange={e => setFormVO2(f => ({ ...f, lactate_lt2_vo2_percent: num(e.target.value) }))} className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">Composición Corporal</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Protocolo</label>
                        <select value={formAnthro.measurement_protocol || 'ISAK'} onChange={e => setFormAnthro(f => ({ ...f, measurement_protocol: e.target.value }))} className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                          <option value="ISAK">ISAK</option>
                          <option value="DEXA">DEXA</option>
                          <option value="Bioimpedance">Bioimpedancia</option>
                          <option value="Hidrostático">Pesaje Hidrostático</option>
                          <option value="ISAK / DEXA">ISAK / DEXA</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">% Graso Media</label>
                        <input type="number" step="0.1" value={formAnthro.body_fat_mean ?? ''} onChange={e => setFormAnthro(f => ({ ...f, body_fat_mean: num(e.target.value) }))} className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">% Graso DS</label>
                        <input type="number" step="0.1" value={formAnthro.body_fat_sd ?? ''} onChange={e => setFormAnthro(f => ({ ...f, body_fat_sd: num(e.target.value) }))} className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">% Graso Min</label>
                        <input type="number" step="0.1" value={formAnthro.body_fat_min ?? ''} onChange={e => setFormAnthro(f => ({ ...f, body_fat_min: num(e.target.value) }))} className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">% Graso Max</label>
                        <input type="number" step="0.1" value={formAnthro.body_fat_max ?? ''} onChange={e => setFormAnthro(f => ({ ...f, body_fat_max: num(e.target.value) }))} className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">% Muscular Media</label>
                        <input type="number" step="0.1" value={formAnthro.muscle_mass_percent_mean ?? ''} onChange={e => setFormAnthro(f => ({ ...f, muscle_mass_percent_mean: num(e.target.value) }))} className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">% Muscular DS</label>
                        <input type="number" step="0.1" value={formAnthro.muscle_mass_percent_sd ?? ''} onChange={e => setFormAnthro(f => ({ ...f, muscle_mass_percent_sd: num(e.target.value) }))} className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">Σ6 Pliegues e Índice Músculo-Óseo</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Σ6 Pliegues Media (mm)</label>
                        <input type="number" step="0.1" value={formAnthro.sum_6_skinfolds_mean ?? ''} onChange={e => setFormAnthro(f => ({ ...f, sum_6_skinfolds_mean: num(e.target.value) }))} className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Σ6 DS</label>
                        <input type="number" step="0.1" value={formAnthro.sum_6_skinfolds_sd ?? ''} onChange={e => setFormAnthro(f => ({ ...f, sum_6_skinfolds_sd: num(e.target.value) }))} className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Σ6 Min (mm)</label>
                        <input type="number" step="0.1" value={formAnthro.sum_6_skinfolds_min ?? ''} onChange={e => setFormAnthro(f => ({ ...f, sum_6_skinfolds_min: num(e.target.value) }))} className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Σ6 Max (mm)</label>
                        <input type="number" step="0.1" value={formAnthro.sum_6_skinfolds_max ?? ''} onChange={e => setFormAnthro(f => ({ ...f, sum_6_skinfolds_max: num(e.target.value) }))} className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Índice Músculo-Óseo</label>
                        <input type="number" step="0.01" value={formAnthro.muscle_bone_ratio_mean ?? ''} onChange={e => setFormAnthro(f => ({ ...f, muscle_bone_ratio_mean: num(e.target.value) }))} className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Índice M-O DS</label>
                        <input type="number" step="0.01" value={formAnthro.muscle_bone_ratio_sd ?? ''} onChange={e => setFormAnthro(f => ({ ...f, muscle_bone_ratio_sd: num(e.target.value) }))} className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Descripción de la Población *</label>
                <input type="text" placeholder="Ej. Ciclistas élite chilenos (selección nacional, Santiago)" value={tab === 'vo2' ? formVO2.population : formAnthro.population} onChange={e => { if (tab === 'vo2') setFormVO2(f => ({ ...f, population: e.target.value })); else setFormAnthro(f => ({ ...f, population: e.target.value })); }} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Cita bibliográfica (completa)</label>
                  <input type="text" placeholder="Autor(es), año, revista..." value={tab === 'vo2' ? formVO2.citation : formAnthro.citation} onChange={e => { if (tab === 'vo2') setFormVO2(f => ({ ...f, citation: e.target.value })); else setFormAnthro(f => ({ ...f, citation: e.target.value })); }} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Cita corta</label>
                  <input type="text" placeholder="Autor (año)" value={tab === 'vo2' ? formVO2.citation_short : formAnthro.citation_short} onChange={e => { if (tab === 'vo2') setFormVO2(f => ({ ...f, citation_short: e.target.value })); else setFormAnthro(f => ({ ...f, citation_short: e.target.value })); }} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Año</label>
                  <input type="number" placeholder="2024" value={tab === 'vo2' ? (formVO2.year ?? '') : (formAnthro.year ?? '')} onChange={e => { const y = parseInt(e.target.value) || null; if (tab === 'vo2') setFormVO2(f => ({ ...f, year: y })); else setFormAnthro(f => ({ ...f, year: y })); }} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notas</label>
                  <input type="text" placeholder="Tamaño muestral, método, limitaciones..." value={tab === 'vo2' ? (formVO2.notes ?? '') : (formAnthro.notes ?? '')} onChange={e => { const notes = e.target.value || null; if (tab === 'vo2') setFormVO2(f => ({ ...f, notes })); else setFormAnthro(f => ({ ...f, notes })); }} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button onClick={() => { setShowForm(false); setEditId(null); }} className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 transition-colors">Cancelar</button>
                <button
                  onClick={tab === 'vo2' ? handleSubmitVO2 : handleSubmitAnthro}
                  disabled={saving}
                  className="px-6 py-2 text-sm bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 rounded-xl font-semibold hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : editId ? 'Actualizar' : 'Guardar Población'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-sm">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Confirmar Eliminación</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                ¿Eliminar la referencia de <span className="font-semibold text-gray-900 dark:text-white">{deleteConfirm.name}</span>?
              </p>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/30 rounded-lg px-3 py-2">
                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                  {builtInList.find(i => i.id === deleteConfirm.id) ? 'Esto ocultará la referencia integrada de la vista.' : 'Esto eliminará permanentemente la referencia personalizada.'}
                </p>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm.id, !!builtInList.find(i => i.id === deleteConfirm.id))}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
