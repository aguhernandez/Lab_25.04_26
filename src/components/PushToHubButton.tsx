import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';

interface PushToHubButtonProps {
  athleteId: string;
  athleteName: string;
  onToast: (message: string, type: 'success' | 'error') => void;
}

interface PassportPreview {
  testDate: string | null;
  vo2max: number | null;
  lt1: { hr: number | null; power: number | null };
  lt2: { hr: number | null; power: number | null };
  quality: string | null;
  previousChanges: Array<{ label: string; before: number; after: number; unit: string }>;
  hasPrevious: boolean;
  manualSevenZones: Array<Record<string, unknown>> | null;
}

type Snapshot = {
  test_id?: string | null;
  date?: string | null;
  vo2max_relative_ml_kg_min?: number | null;
  lt1_hr?: number | null;
  lt1_power?: number | null;
  lt2_hr?: number | null;
  lt2_power?: number | null;
};

export default function PushToHubButton({ athleteId, athleteName, onToast }: PushToHubButtonProps) {
  const { language } = useLanguage();
  const es = language === 'es';
  const [pushing, setPushing] = useState(false);
  const [open, setOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<PassportPreview | null>(null);

  const loadPreview = async () => {
    setPreviewLoading(true);
    const [{ data: profile }, { data: zoneProfile }] = await Promise.all([
      supabase.from('athlete_physiology_profiles').select('*').eq('athlete_id', athleteId).maybeSingle(),
      supabase.from('athlete_training_zones').select('mode, heart_rate_zones, power_zones').eq('athlete_id', athleteId).maybeSingle(),
    ]);

    let result: Record<string, unknown> | null = null;
    if (profile?.last_test_id) {
      const [{ data: test }, { data: testResult }] = await Promise.all([
        supabase.from('tests').select('test_date').eq('id', profile.last_test_id).maybeSingle(),
        supabase.from('test_results').select('data_quality').eq('test_id', profile.last_test_id).maybeSingle(),
      ]);
      result = testResult as Record<string, unknown> | null;
      if (!profile.last_test_date && test?.test_date) profile.last_test_date = test.test_date;
    }

    const history = Array.isArray(profile?.history) ? profile.history as Snapshot[] : [];
    const previous = history.find(snapshot => snapshot.test_id && snapshot.test_id !== profile?.last_test_id)
      ?? history.find((_, index) => index > 0)
      ?? null;
    const currentFields: Array<{ key: keyof Snapshot; profileKey: string; label: string; unit: string }> = [
      { key: 'vo2max_relative_ml_kg_min', profileKey: 'vo2max_relative_ml_kg_min', label: 'VO₂max', unit: 'ml/kg/min' },
      { key: 'lt1_hr', profileKey: 'lt1_hr', label: 'LT1 FC', unit: es ? 'lpm' : 'bpm' },
      { key: 'lt1_power', profileKey: 'lt1_power', label: 'LT1', unit: 'W' },
      { key: 'lt2_hr', profileKey: 'lt2_hr', label: 'LT2 FC', unit: es ? 'lpm' : 'bpm' },
      { key: 'lt2_power', profileKey: 'lt2_power', label: 'LT2', unit: 'W' },
    ];
    const previousChanges = previous ? currentFields.flatMap(field => {
      const before = previous[field.key];
      const after = profile?.[field.profileKey];
      if (before == null || after == null || Number(before) === Number(after)) return [];
      return [{ label: field.label, before: Number(before), after: Number(after), unit: field.unit }];
    }) : [];

    const rawManualZones = zoneProfile?.mode === 'manual_override' && Array.isArray(zoneProfile.heart_rate_zones) && zoneProfile.heart_rate_zones.length === 7
      ? zoneProfile.heart_rate_zones as Array<Record<string, unknown>>
      : null;
    const previewData: PassportPreview = {
      testDate: profile?.last_test_date ?? null,
      vo2max: profile?.vo2max_relative_ml_kg_min ?? null,
      lt1: { hr: profile?.lt1_hr ?? null, power: profile?.lt1_power ?? null },
      lt2: { hr: profile?.lt2_hr ?? null, power: profile?.lt2_power ?? null },
      quality: (result?.data_quality as string | null) ?? null,
      previousChanges,
      hasPrevious: !!previous,
      manualSevenZones: rawManualZones,
    };
    setPreview(previewData);
    setPreviewLoading(false);
  };

  const openConfirmation = () => {
    setOpen(true);
    setPreview(null);
    void loadPreview().catch(() => {
      setPreviewLoading(false);
      onToast(es ? 'No se pudo preparar el resumen del pasaporte.' : 'Could not prepare the passport summary.', 'error');
    });
  };

  const handlePush = async () => {
    setPushing(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${supabaseUrl}/functions/v1/push-to-hub`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? supabaseAnonKey}`,
          'Apikey': supabaseAnonKey,
        },
        // Preserve the existing request contract exactly.
        body: JSON.stringify({ athlete_id: athleteId }),
      });
      const data = await response.json();
      if (!response.ok) {
        const msg = data?.error ?? 'Push failed';
        const hubDetail = data?.hub_response ? ` | Hub: ${JSON.stringify(data.hub_response)}` : '';
        if (msg.includes('Planner token not configured')) {
          onToast(es ? 'Falta configurar el token del Planner. Revisá Configuración > Integración con Hub.' : 'Planner token not configured. Go to Settings > Hub Integration to add it.', 'error');
        } else {
          onToast(`${es ? 'Falló el envío' : 'Push failed'}: ${msg}${hubDetail}`, 'error');
        }
        console.error('Push to Hub failed:', data);
        return;
      }
      setOpen(false);
      onToast(es ? `Pasaporte de ${athleteName} enviado al Hub.` : `Passport of ${athleteName} sent to Hub successfully.`, 'success');
    } catch {
      onToast(es ? 'Error de red. No se pudo contactar con Hub.' : 'Network error. Could not reach the Hub.', 'error');
    } finally {
      setPushing(false);
    }
  };

  const format = (value: number | null | undefined, unit: string) => value == null ? null : `${Number.isInteger(value) ? value : value.toFixed(1)} ${unit}`;
  const displaySevenZone = (zone: Record<string, unknown>) => {
    const index = zone.zone ?? '';
    const name = zone.name ?? '';
    const min = zone.hr_min ?? zone.min_bpm;
    const max = zone.hr_max ?? zone.max_bpm;
    if (min == null || max == null) return `${index} ${name}`.trim();
    return `${index} ${name}: ${min}–${max} ${es ? 'lpm' : 'bpm'}`.trim();
  };

  const summaryRows = preview ? [
    preview.testDate ? { label: es ? 'Fecha del test' : 'Test date', value: new Date(preview.testDate).toLocaleDateString(es ? 'es-ES' : 'en-US') } : null,
    format(preview.vo2max, 'ml/kg/min') ? { label: 'VO₂max', value: format(preview.vo2max, 'ml/kg/min')! } : null,
    format(preview.lt1.hr, es ? 'lpm' : 'bpm') ? { label: 'LT1 · FC', value: format(preview.lt1.hr, es ? 'lpm' : 'bpm')! } : null,
    format(preview.lt1.power, 'W') ? { label: 'LT1 · potencia', value: format(preview.lt1.power, 'W')! } : null,
    format(preview.lt2.hr, es ? 'lpm' : 'bpm') ? { label: 'LT2 · FC', value: format(preview.lt2.hr, es ? 'lpm' : 'bpm')! } : null,
    format(preview.lt2.power, 'W') ? { label: 'LT2 · potencia', value: format(preview.lt2.power, 'W')! } : null,
    preview.quality ? { label: es ? 'Calidad del dato' : 'Data quality', value: preview.quality } : null,
  ].filter((row): row is { label: string; value: string } => row !== null) : [];

  return <>
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      <div className="bg-slate-700 px-5 py-3.5 flex items-center gap-3">
        <div className="bg-white/10 rounded-lg p-2" aria-hidden="true">⇧</div>
        <div>
          <h3 className="text-base font-semibold text-white">{es ? 'Integración con Hub' : 'Hub integration'}</h3>
          <p className="text-xs text-white/65">{es ? 'Enviar el pasaporte biológico al perfil del atleta' : "Send the biological passport to the athlete's Hub profile"}</p>
        </div>
      </div>
      <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-2xl text-sm text-gray-600 dark:text-gray-400">{es ? 'Se enviará el perfil fisiológico y antropométrico vigente. Podés revisar el resumen antes de confirmar.' : 'The current physiological and anthropometric profile will be sent. Review the summary before confirming.'}</p>
        <button onClick={openConfirmation} disabled={pushing} className="shrink-0 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white px-4 py-2.5 text-sm font-semibold transition-colors">
          {es ? 'Revisar y enviar al Hub' : 'Review and send to Hub'}
        </button>
      </div>
    </div>

    {open && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4" onMouseDown={event => { if (event.target === event.currentTarget && !pushing) setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="hub-confirm-title" className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-5 py-4">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{es ? 'Confirmación de envío' : 'Send confirmation'}</p><h2 id="hub-confirm-title" className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{es ? `Pasaporte de ${athleteName}` : `${athleteName}'s passport`}</h2></div>
          <button aria-label={es ? 'Cerrar' : 'Close'} onClick={() => setOpen(false)} disabled={pushing} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"><X className="h-5 w-5" /></button>
        </header>
        <div className="space-y-5 px-5 py-5">
          {previewLoading ? <div className="py-10 text-center text-sm text-gray-500">{es ? 'Preparando resumen…' : 'Preparing summary…'}</div> : preview && <>
            <section>
              <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">{es ? 'Datos que se enviarán' : 'Data to be sent'}</h3>
              {summaryRows.length > 0 && <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 rounded-xl bg-gray-50 dark:bg-gray-900/50 p-4">
                {summaryRows.map(row => <div key={row.label} className="flex justify-between gap-4 text-sm"><dt className="text-gray-500 dark:text-gray-400">{row.label}</dt><dd className="text-right font-medium tabular-nums text-gray-900 dark:text-white">{row.value}</dd></div>)}
              </dl>}
              <div className="mt-3 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{es ? '7 zonas' : '7 zones'}</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{es ? 'El contrato Hub envía zonas de FC y RPE, y zonas de potencia cuando hay umbrales de potencia disponibles.' : 'The Hub contract sends heart-rate and RPE zones, plus power zones when power thresholds are available.'}</p>
                {preview.manualSevenZones ? <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-700 dark:text-gray-300">{preview.manualSevenZones.map((zone, index) => <li key={index} className="tabular-nums">{displaySevenZone(zone)}</li>)}</ul> : <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{es ? 'Los valores se forman en el Hub al procesar este envío a partir del perfil vigente.' : 'The Hub forms zone values from the active profile when it processes this send.'}</p>}
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">vs snapshot anterior</h3>
              {!preview.hasPrevious ? <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{es ? 'No hay un snapshot fisiológico anterior para comparar.' : 'There is no previous physiological snapshot to compare.'}</p>
                : preview.previousChanges.length ? <ul className="mt-2 space-y-1.5 text-sm">{preview.previousChanges.map(change => <li key={change.label} className="flex flex-wrap justify-between gap-x-4 gap-y-1"><span className="text-gray-600 dark:text-gray-400">{change.label}</span><span className="tabular-nums text-gray-900 dark:text-white">{format(change.before, change.unit)} → {format(change.after, change.unit)}</span></li>)}</ul>
                  : <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{es ? 'Sin cambios en los campos comparables del snapshot.' : 'No changes in the comparable snapshot fields.'}</p>}
              <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">{es ? 'La comparación usa solo los campos que existen en el historial fisiológico.' : 'This comparison uses only fields available in the physiology history.'}</p>
            </section>
          </>}
        </div>
        <footer className="sticky bottom-0 flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-5 py-4">
          <button onClick={() => setOpen(false)} disabled={pushing} className="rounded-lg bg-gray-100 dark:bg-gray-700 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 disabled:opacity-50">{es ? 'Cancelar' : 'Cancel'}</button>
          <button onClick={() => void handlePush()} disabled={pushing || previewLoading || !preview} className="rounded-lg bg-[#fdda36] px-4 py-2.5 text-sm font-bold text-[#514163] disabled:opacity-50">{pushing ? (es ? 'Enviando…' : 'Sending…') : (es ? 'Confirmar envío' : 'Confirm send')}</button>
        </footer>
      </section>
    </div>}
  </>;
}
