import { useState } from 'react';
import { calculateBlandAltman, type PairedObservation } from '../lib/scientificValidation';

/** User-entered references are kept in memory; they are not a validation cohort. */
export default function ValidationReferenceComparison({ metrics, language }: { metrics: Record<string, { value: number | null; unit: string }>; language: string }) {
  const en = language === 'en';
  const [metric, setMetric] = useState('LT2'); const [reference, setReference] = useState(''); const [pairs, setPairs] = useState('');
  const candidate = metrics[metric]?.value;
  const ref = reference.trim() ? Number(reference) : NaN;
  const lines = pairs.trim() ? pairs.trim().split(/\r?\n/) : [];
  const rows: PairedObservation[] = lines.flatMap(line => {
    const cells = line.split(';').map(v => v.trim());
    if (cells.length !== 3 || !cells[0] || !cells[1] || !cells[2]) return [];
    const candidate = Number(cells[1].replace(',', '.')), reference = Number(cells[2].replace(',', '.'));
    return Number.isFinite(candidate) && Number.isFinite(reference) ? [{ subjectId: cells[0], candidate, reference }] : [];
  });
  const distinct = new Set(rows.map(r => r.subjectId)).size === rows.length;
  const summary = rows.length === lines.length && distinct ? calculateBlandAltman(rows) : null;
  const field = 'rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white';
  return <details className="mt-4 border-t border-amber-200 pt-3 dark:border-amber-800"><summary className="cursor-pointer text-xs font-bold dark:text-white">{en ? 'Compare with measured references' : 'Comparar con mediciones de referencia'}</summary>
    <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">{en ? 'Enter a comparable independent measurement, using the same modality, units and protocol. One comparison does not establish validity.' : 'Introduce una medición independiente comparable, con la misma modalidad, unidades y protocolo. Una comparación no valida el modelo.'}</p>
    <div className="mt-3 flex flex-wrap items-end gap-2"><label className="text-xs dark:text-gray-200">{en ? 'Result' : 'Resultado'}<select className={`${field} mt-1 block`} value={metric} onChange={e => { setMetric(e.target.value); setReference(''); setPairs(''); }}>{Object.keys(metrics).map(key => <option key={key}>{key}</option>)}</select></label><label className="text-xs dark:text-gray-200">{en ? 'Reference measurement' : 'Medición de referencia'} ({metrics[metric]?.unit})<input className={`${field} mt-1 block`} type="number" step="any" value={reference} onChange={e => setReference(e.target.value)} /></label></div>
    {candidate != null && Number.isFinite(ref) && <p className="mt-2 text-sm dark:text-white">{en ? 'LAB minus reference' : 'LAB menos referencia'}: <strong>{(candidate - ref).toFixed(2)} {metrics[metric]?.unit}</strong></p>}
    <p className="mt-3 text-xs text-gray-600 dark:text-gray-300">{en ? 'For a study, paste independent paired values as one participant per line: anonymous ID; LAB; reference. Use one metric and identical units.' : 'Para un estudio, pega pares independientes: una persona por línea con ID anónimo; LAB; referencia. Usa una sola métrica y las mismas unidades.'}</p>
    <textarea className={`${field} mt-2 w-full`} rows={3} value={pairs} onChange={e => setPairs(e.target.value)} placeholder={'A01; 245; 250\nA02; 260; 255'} />
    {lines.length > 0 && (!distinct || rows.length !== lines.length) && <p role="alert" className="text-xs text-red-700">{en ? 'Check all rows and use unique anonymous IDs.' : 'Revisa todas las filas y usa identificadores anónimos únicos.'}</p>}
    {summary && <p className="mt-2 text-xs dark:text-gray-200">n = {summary.n} · {en ? 'Bias' : 'Sesgo'} {summary.bias.toFixed(2)} ({summary.biasCi95[0].toFixed(2)}–{summary.biasCi95[1].toFixed(2)}; IC95%) · {en ? '95% limits of agreement' : 'Límites de concordancia 95%'} {summary.lowerLimit.toFixed(2)} a {summary.upperLimit.toFixed(2)} {metrics[metric]?.unit}. IC95%: [{summary.lowerLimitCi95.map(v => v.toFixed(2)).join(', ')}] / [{summary.upperLimitCi95.map(v => v.toFixed(2)).join(', ')}]. {en ? 'Approximate; prespecify acceptable differences and verify assumptions. Small samples yield uncertain limits.' : 'Aproximados; define diferencias aceptables antes del análisis y comprueba los supuestos. Las muestras pequeñas dan límites imprecisos.'}</p>}
    <p className="mt-2 text-xs text-gray-500">{en ? 'Values stay in this browser session and are not saved.' : 'Los valores permanecen en esta sesión del navegador y no se guardan.'}</p>
  </details>;
}
