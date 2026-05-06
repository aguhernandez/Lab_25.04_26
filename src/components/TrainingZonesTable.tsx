import { useState } from 'react';
import { Sport } from '../types';
import { ZoneDefinition, ZoneDisplayMode, TrainingZonesData, getZoneColor, getZoneTextColor, convertTo5Zones, calculateZones7 } from '../lib/trainingZones';

interface TrainingZonesTableProps {
  zones?: ZoneDefinition[] | null;
  zonesData?: TrainingZonesData | null;
  sport: Sport;
  defaultMode?: ZoneDisplayMode;
  lt1_hr?: number | null;
  lt2_hr?: number | null;
  hrmax?: number | null;
}

export default function TrainingZonesTable({
  zones,
  zonesData,
  sport,
  defaultMode,
  lt1_hr,
  lt2_hr,
  hrmax,
}: TrainingZonesTableProps) {
  const inferredDefault: ZoneDisplayMode = defaultMode ?? zonesData?.defaultDisplay ?? '5';
  const [mode, setMode] = useState<ZoneDisplayMode>(inferredDefault);

  const resolveZones = (): ZoneDefinition[] => {
    if (zonesData) {
      return mode === '7' ? zonesData.zones7 : zonesData.zones5;
    }
    if (zones && zones.length > 0) {
      if (mode === '7' && zones.length <= 5 && lt1_hr != null && lt2_hr != null && hrmax != null) {
        const z7 = calculateZones7(lt1_hr, lt2_hr, hrmax, sport);
        const hasPower = zones.some(z => z.power_min != null);
        if (hasPower) {
          z7.forEach((z, i) => {
            z.power_min = zones[Math.min(i, zones.length - 1)].power_min;
            z.power_max = zones[Math.min(i, zones.length - 1)].power_max;
          });
        }
        return z7;
      }
      if (mode === '5' && zones.length === 7) {
        return convertTo5Zones(zones as ZoneDefinition[], sport);
      }
      return zones as ZoneDefinition[];
    }
    return [];
  };

  const displayZones = resolveZones();
  if (displayZones.length === 0) return null;

  const totalZones = displayZones.length as 5 | 7;
  const hasPower = displayZones.some(z => z.power_min != null);
  const hasPace = displayZones.some(z => z.pace_min != null || z.pace_max != null);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="bg-gradient-to-r from-gray-800 to-gray-700 dark:from-gray-900 dark:to-gray-800 px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-lg p-2">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white">Training Zones</h3>
          </div>

          <div className="flex items-center bg-white/10 rounded-xl p-1 gap-1">
            <button
              onClick={() => setMode('5')}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                mode === '5'
                  ? 'bg-white text-gray-800 shadow'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              5 zones
            </button>
            <button
              onClick={() => setMode('7')}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                mode === '7'
                  ? 'bg-white text-gray-800 shadow'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              7 zones
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Zone</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Name</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Heart Rate</th>
                {hasPower && <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Power</th>}
                {hasPace && <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Pace</th>}
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Purpose</th>
              </tr>
            </thead>
            <tbody>
              {displayZones.map((zone) => (
                <tr
                  key={zone.zone}
                  className="border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <td className="py-4 px-4">
                    <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full border-2 font-bold text-sm ${getZoneColor(zone.zone, totalZones)} ${getZoneTextColor(zone.zone, totalZones)}`}>
                      {zone.zone}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="font-semibold text-gray-900 dark:text-white">{zone.name}</span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="font-mono text-sm text-gray-700 dark:text-gray-300">
                      {zone.hr_min} – {zone.hr_max} bpm
                    </span>
                  </td>
                  {hasPower && (
                    <td className="py-4 px-4">
                      {zone.power_min != null && zone.power_max != null ? (
                        <span className="font-mono text-sm text-gray-700 dark:text-gray-300">
                          {zone.power_min} – {zone.power_max} W
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>
                  )}
                  {hasPace && (
                    <td className="py-4 px-4">
                      {zone.pace_min || zone.pace_max ? (
                        <span className="font-mono text-sm text-gray-700 dark:text-gray-300">
                          {zone.pace_max && zone.pace_min ? `${zone.pace_max} – ${zone.pace_min}` : (zone.pace_max ?? zone.pace_min)}
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>
                  )}
                  <td className="py-4 px-4">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {zone.description}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-700">
          <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-blue-900 dark:text-blue-100">
            <strong>Base method:</strong> LT1/LT2 physiological thresholds.
            {mode === '7'
              ? ' 7-zone model provides granular physiological precision.'
              : ' 5-zone model groups zones for practical training application.'}
            {' '}Adjust based on athlete response.
          </p>
        </div>
      </div>
    </div>
  );
}
