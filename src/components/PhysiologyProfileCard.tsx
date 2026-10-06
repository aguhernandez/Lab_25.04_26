import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  AthletePhysiologyProfile,
  AthleteTrainingZones,
  fetchAthletePhysiologyProfile,
  fetchAthleteTrainingZones,
  lockZonesToLab,
  updateTrainingZonesManual
} from '../lib/physiologyProfile';
import { TrainingZone, TestDataPoint, AdvancedMetrics } from '../types';
import { calculatePhysiology, calculateAdvancedMetrics, PhysiologyResults, type TimelineHRSample } from '../lib/physiology';
import ManualPhysiologyForm from './ManualPhysiologyForm';
import AdvancedData from './AdvancedData';
import { calculateZones7, convertTo5Zones } from '../lib/trainingZones';
import { Sport } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface PhysiologyProfileCardProps {
  athleteId: string;
  sport: string;
  onToast?: (message: string, type: 'success' | 'error') => void;
}

type TabKey = 'physiology' | 'zones' | 'advanced' | 'history';

export default function PhysiologyProfileCard({ athleteId, sport, onToast }: PhysiologyProfileCardProps) {
  const { language } = useLanguage();
  const [profile, setProfile] = useState<AthletePhysiologyProfile | null>(null);
  const [zones, setZones] = useState<AthleteTrainingZones | null>(null);
  const [loading, setLoading] = useState(true);
  const [lockingZones, setLockingZones] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('advanced');
  const [showManualForm, setShowManualForm] = useState(false);
  const [editingZones, setEditingZones] = useState(false);
  const [editZoneValues, setEditZoneValues] = useState<TrainingZone[]>([]);
  const [savingZones, setSavingZones] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [advancedTest, setAdvancedTest] = useState<{
    results: PhysiologyResults;
    advancedMetrics: AdvancedMetrics | null;
    dataPoints: TestDataPoint[];
    timelineSamples: TimelineHRSample[];
  } | null>(null);

  useEffect(() => {
    setActiveTab('advanced');
    loadProfile();
  }, [athleteId]);

  const loadProfile = async () => {
    setLoading(true);
    const [profileData, zonesData] = await Promise.all([
      fetchAthletePhysiologyProfile(athleteId),
      fetchAthleteTrainingZones(athleteId)
    ]);
    setProfile(profileData);
    setZones(zonesData);

    if (profileData?.last_test_id) {
      const [{ data: pointRows }, { data: timelineRows }, { data: resultRow }, { data: athleteRow }] = await Promise.all([
        supabase.from('test_data_points').select('*').eq('test_id', profileData.last_test_id).order('stage_number', { ascending: true }),
        supabase.from('test_timeline_samples').select('timestamp_s, heart_rate, speed_pace, lactate, rpe, vo2_ml_kg_min').eq('test_id', profileData.last_test_id).order('timestamp_s', { ascending: true }),
        supabase.from('test_results').select('results_snapshot, advanced_metrics').eq('test_id', profileData.last_test_id).maybeSingle(),
        supabase.from('athletes').select('*').eq('id', athleteId).maybeSingle(),
      ]);
      const snapshot = (resultRow as { results_snapshot?: { results?: PhysiologyResults; advancedMetrics?: AdvancedMetrics | null } } | null)?.results_snapshot;
      if (pointRows && pointRows.length > 0) {
        const dataPoints = pointRows as TestDataPoint[];
        const calculatedResults = snapshot?.results ?? (athleteRow ? calculatePhysiology(athleteRow as import('../types').Athlete, dataPoints) : null);
        if (calculatedResults) {
          setAdvancedTest({
            results: calculatedResults,
            advancedMetrics: snapshot?.advancedMetrics ?? ((resultRow as { advanced_metrics?: AdvancedMetrics | null } | null)?.advanced_metrics ?? (athleteRow ? calculateAdvancedMetrics(athleteRow as import('../types').Athlete, dataPoints, calculatedResults) : null)),
            dataPoints,
            timelineSamples: (timelineRows as TimelineHRSample[]) ?? [],
          });
        } else {
          setAdvancedTest(null);
        }
      } else {
        setAdvancedTest(null);
      }
    } else {
      setAdvancedTest(null);
    }

    setLoading(false);
  };

  const handleToggleLock = async () => {
    if (!zones) return;
    setLockingZones(true);
    try {
      const newLocked = !zones.locked_to_lab;
      const ok = await lockZonesToLab(athleteId, newLocked);
      if (ok) {
        setZones({ ...zones, locked_to_lab: newLocked });
        onToast?.(
          newLocked ? 'Zones locked to physiology.' : 'Zones unlocked for manual editing.',
          'success'
        );
      }
    } finally {
      setLockingZones(false);
    }
  };

  const handleStartEditZones = () => {
    if (!zones) return;
    setEditZoneValues(zones.heart_rate_zones.map(z => ({ ...z })));
    setEditingZones(true);
  };

  const handleCancelEditZones = () => {
    setEditingZones(false);
    setEditZoneValues([]);
  };

  const handleZoneFieldChange = (zoneIndex: number, field: keyof TrainingZone, value: string) => {
    setEditZoneValues(prev => {
      const updated = [...prev];
      const zone = { ...updated[zoneIndex] };
      if (field === 'hr_min' || field === 'hr_max' || field === 'power_min' || field === 'power_max') {
        const num = parseInt(value);
        (zone as Record<string, unknown>)[field] = isNaN(num) ? undefined : num;
      } else if (field === 'pace_min' || field === 'pace_max') {
        (zone as Record<string, unknown>)[field] = value || undefined;
      } else if (field === 'name' || field === 'description') {
        (zone as Record<string, unknown>)[field] = value;
      }
      updated[zoneIndex] = zone;
      return updated;
    });
  };

  const handleSaveZones = async () => {
    setSavingZones(true);
    try {
      const ok = await updateTrainingZonesManual(athleteId, editZoneValues, 'coach');
      if (ok) {
        await loadProfile();
        setEditingZones(false);
        setEditZoneValues([]);
        onToast?.('Training zones updated.', 'success');
      } else {
        onToast?.('Failed to save zones.', 'error');
      }
    } finally {
      setSavingZones(false);
    }
  };

  const handleManualSaved = async () => {
    setShowManualForm(false);
    await loadProfile();
  };

  const handleRecalculateZones = async (mode: '5' | '7') => {
    if (!profile) return;
    setRecalculating(true);
    try {
      const effectiveSport: Sport = (sport as Sport) || 'other';
      const hrmax = profile.hrmax || 0;
      const zones7 = calculateZones7(
        profile.lt1_hr, profile.lt2_hr, hrmax, effectiveSport,
        undefined,
        { vam_kmh: profile.vam_kmh, pam_watts: profile.pam_watts, threshold_confidence: 'measured', language, threshold_source: 'lactate' },
      );
      const newZones = mode === '7' ? zones7 : convertTo5Zones(zones7, effectiveSport, language);
      const ok = await updateTrainingZonesManual(athleteId, newZones as TrainingZone[], 'coach');
      if (ok) {
        await loadProfile();
        onToast?.(`Zones recalculated with ${mode}-zone model.`, 'success');
      } else {
        onToast?.('Failed to recalculate zones.', 'error');
      }
    } finally {
      setRecalculating(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading physiology profile...</p>
      </div>
    );
  }

  if (!profile && !showManualForm) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white">No Physiology Profile</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Complete a lab test or enter data manually to generate this athlete's physiological profile.
            </p>
            <button
              onClick={() => setShowManualForm(true)}
              className="mt-3 px-4 py-2 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 rounded-lg text-sm font-semibold hover:bg-slate-700 dark:hover:bg-slate-100 transition-colors"
            >
              Enter Data Manually
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showManualForm) {
    const prePopulated = profile ? {
      vo2max_relative_ml_kg_min: profile.vo2max_relative_ml_kg_min,
      vo2max_absolute_l_min: profile.vo2max_absolute_l_min,
      hrmax: profile.hrmax,
      lt1_hr: profile.lt1_hr,
      lt1_power: profile.lt1_power,
      lt1_pace: profile.lt1_pace,
      lt2_hr: profile.lt2_hr,
      lt2_power: profile.lt2_power,
      lt2_pace: profile.lt2_pace,
      fatmax_hr: profile.fatmax_hr,
      fatmax_power: profile.fatmax_power,
      fatmax_pace: profile.fatmax_pace,
      vam_kmh: profile.vam_kmh,
      pam_watts: profile.pam_watts,
    } : undefined;

    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">Manual Physiology Entry</h2>
          <p className="text-xs text-white/70 mt-0.5">Edit values — zones will be recalculated automatically</p>
        </div>
        <div className="p-6">
          <ManualPhysiologyForm
            athleteId={athleteId}
            sport={sport as import('../types').Sport}
            onSaved={handleManualSaved}
            onCancel={() => setShowManualForm(false)}
            onToast={onToast}
            initialValues={prePopulated}
          />
        </div>
      </div>
    );
  }

  const testDate = profile!.last_test_date
    ? new Date(profile!.last_test_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-lg p-2">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Physiological Profile</h2>
              {testDate && (
                <p className="text-xs text-white/70">Last updated: {testDate}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-white/20 text-white text-xs rounded-full font-medium uppercase">
              {profile!.source}
            </span>
            <button
              onClick={() => setShowManualForm(true)}
              className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs rounded-lg font-medium transition-colors"
              title="Enter or update data manually"
            >
              Edit / Manual Entry
            </button>
          </div>
        </div>
      </div>

      <div className="border-b border-gray-100 dark:border-gray-700">
        <div className="flex">
          {(['physiology', 'zones', 'advanced', 'history'] as TabKey[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {tab === 'physiology' ? 'Physiological Capacity' : tab === 'zones' ? 'Training Zones' : tab === 'advanced' ? 'Advanced Analysis' : 'History'}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {activeTab === 'physiology' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <MetricCard
                label="VO2max"
                value={profile!.vo2max_relative_ml_kg_min ? `${profile!.vo2max_relative_ml_kg_min.toFixed(1)}` : '—'}
                unit="ml/kg/min"
                badge={profile!.vo2max_confidence}
                color="blue"
              />
              {profile!.vo2max_absolute_l_min && (
                <MetricCard
                  label="VO2max Absolute"
                  value={profile!.vo2max_absolute_l_min.toFixed(2)}
                  unit="L/min"
                  color="blue"
                />
              )}
              {profile!.vo2max_relative_ml_ffm_min && (
                <MetricCard
                  label="VO2max / LBM"
                  value={profile!.vo2max_relative_ml_ffm_min.toFixed(1)}
                  unit="ml/kgFFM/min"
                  color="blue"
                />
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <ThresholdCard
                label="LT1"
                hr={profile!.lt1_hr}
                power={profile!.lt1_power}
                pace={profile!.lt1_pace}
                percentVo2={profile!.lt1_percent_vo2max}
                percentHr={profile!.lt1_percent_hrmax}
                confidence={profile!.lt1_confidence}
                sport={sport}
                color="green"
              />
              <ThresholdCard
                label="FatMax"
                hr={profile!.fatmax_hr}
                power={profile!.fatmax_power}
                pace={profile!.fatmax_pace}
                confidence={profile!.fatmax_confidence}
                sport={sport}
                color="amber"
              />
              <ThresholdCard
                label="LT2"
                hr={profile!.lt2_hr}
                power={profile!.lt2_power}
                pace={profile!.lt2_pace}
                percentVo2={profile!.lt2_percent_vo2max}
                percentHr={profile!.lt2_percent_hrmax}
                confidence={profile!.lt2_confidence}
                sport={sport}
                color="red"
              />
            </div>

            {(profile!.vam_kmh || profile!.pam_watts) && (
              <div className="grid grid-cols-2 gap-3">
                {profile!.vam_kmh && (
                  <MetricCard
                    label="VAM"
                    value={profile!.vam_kmh.toFixed(1)}
                    unit="km/h"
                    color="slate"
                  />
                )}
                {profile!.pam_watts && (
                  <MetricCard
                    label="PAM"
                    value={profile!.pam_watts.toFixed(0)}
                    unit="watts"
                    color="slate"
                  />
                )}
              </div>
            )}

            <div className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/40 rounded-lg px-4 py-3">
              Physiological Capacity — data from lab or manual entry. Use "Edit / Manual Entry" to update. Training zone adjustments are available in the Zones tab.
            </div>
          </div>
        )}

        {activeTab === 'advanced' && (
          <div className="space-y-4">
            {advancedTest ? (
              <AdvancedData
                dataPoints={advancedTest.dataPoints}
                results={advancedTest.results}
                advancedMetrics={advancedTest.advancedMetrics}
                timelineSamples={advancedTest.timelineSamples}
              />
            ) : (
              <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 text-sm text-amber-800 dark:text-amber-200">
                No saved Advanced Analysis is available for the latest test. Open the test results and save the calculated results first.
              </div>
            )}
          </div>
        )}

        {activeTab === 'zones' && (
          <div className="space-y-4">
            {zones ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {zones.mode === 'manual_override' ? 'Manual Override Active' : 'Physiology-Based Zones'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Last modified by {zones.last_modified_by.replace('_', ' ')} on{' '}
                      {new Date(zones.last_modified_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!editingZones && !zones.locked_to_lab && (
                      <button
                        onClick={handleStartEditZones}
                        className="px-3 py-1.5 text-xs rounded-lg font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                      >
                        Edit Zones
                      </button>
                    )}
                    <button
                      onClick={handleToggleLock}
                      disabled={lockingZones}
                      className={`px-3 py-1.5 text-xs rounded-lg font-semibold transition-colors ${
                        zones.locked_to_lab
                          ? 'bg-amber-500 text-white hover:bg-amber-600'
                          : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500'
                      }`}
                    >
                      {zones.locked_to_lab ? 'Locked to Physiology' : 'Lock to Physiology'}
                    </button>
                  </div>
                </div>

                {!editingZones && !zones.locked_to_lab && profile && (
                  <div className="flex items-center gap-2 pb-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Recalculate:</span>
                    {(['5', '7'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => handleRecalculateZones(mode)}
                        disabled={recalculating}
                        className={`px-3 py-1 text-xs rounded-lg font-semibold transition-colors border ${
                          zones.heart_rate_zones.length === parseInt(mode)
                            ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 border-slate-800 dark:border-slate-200'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                        } disabled:opacity-50`}
                      >
                        {mode} Zones
                      </button>
                    ))}
                  </div>
                )}

                {editingZones ? (
                  <ZoneEditor
                    zones={editZoneValues}
                    sport={sport}
                    onChange={handleZoneFieldChange}
                    onSave={handleSaveZones}
                    onCancel={handleCancelEditZones}
                    saving={savingZones}
                  />
                ) : (
                  <div className="space-y-2">
                    {zones.heart_rate_zones.map(zone => (
                      <div key={zone.zone} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/40 rounded-lg">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${zoneColor(zone.zone)}`}>
                          Z{zone.zone}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{zone.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{zone.description}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                            {zone.hr_min}–{zone.hr_max} bpm
                          </p>
                          {zone.power_min !== undefined && zone.power_max !== undefined && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">{zone.power_min}–{zone.power_max}W</p>
                          )}
                          {(zone.pace_min || zone.pace_max) && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {zone.pace_min || '—'} → {zone.pace_max || '—'}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!editingZones && zones.physiology_reference && (
                  <div className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/40 rounded-lg px-4 py-3">
                    Based on: LT1 = {zones.physiology_reference.lt1_hr ?? '—'} bpm
                    {zones.physiology_reference.lt1_power ? ` / ${zones.physiology_reference.lt1_power}W` : ''}
                    {zones.physiology_reference.lt1_pace ? ` / ${zones.physiology_reference.lt1_pace}` : ''}
                    {' · '}
                    LT2 = {zones.physiology_reference.lt2_hr ?? '—'} bpm
                    {zones.physiology_reference.lt2_power ? ` / ${zones.physiology_reference.lt2_power}W` : ''}
                    {zones.physiology_reference.lt2_pace ? ` / ${zones.physiology_reference.lt2_pace}` : ''}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">No training zones available yet.</p>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-3">
            {profile!.history && profile!.history.length > 0 ? (
              profile!.history.map((snapshot, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/40 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {new Date(snapshot.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </p>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 space-x-3">
                      {snapshot.vo2max_relative_ml_kg_min && (
                        <span>VO2max: {snapshot.vo2max_relative_ml_kg_min.toFixed(1)} ml/kg/min</span>
                      )}
                      {snapshot.lt2_hr && <span>LT2: {snapshot.lt2_hr} bpm</span>}
                      {snapshot.pam_watts && <span>PAM: {snapshot.pam_watts}W</span>}
                      {snapshot.vam_kmh && <span>VAM: {snapshot.vam_kmh} km/h</span>}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded-full">
                    {snapshot.source}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">No history available yet.</p>
            )}

            {zones?.zone_history && zones.zone_history.length > 0 && (
              <>
                <div className="pt-3 border-t border-gray-200 dark:border-gray-600">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Zone Change History</p>
                  {zones.zone_history.map((entry, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        entry.source === 'lab_auto_update' ? 'bg-green-500' : 'bg-amber-500'
                      }`} />
                      <span className="text-xs text-gray-600 dark:text-gray-300">
                        {new Date(entry.date).toLocaleDateString()}
                      </span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        entry.source === 'lab_auto_update'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                      }`}>
                        {entry.source.replace(/_/g, ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface ZoneEditorProps {
  zones: TrainingZone[];
  sport: string;
  onChange: (index: number, field: keyof TrainingZone, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}

function ZoneEditor({ zones, sport, onChange, onSave, onCancel, saving }: ZoneEditorProps) {
  const paceUnit = sport === 'cycling' ? 'km/h' : sport === 'swimming' ? '/100m' : '/km';

  return (
    <div className="space-y-3">
      {zones.map((zone, i) => (
        <div key={zone.zone} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${zoneColor(zone.zone)}`}>
              Z{zone.zone}
            </div>
            <input
              type="text"
              value={zone.name}
              onChange={e => onChange(i, 'name', e.target.value)}
              className="flex-1 text-sm font-semibold bg-transparent text-gray-900 dark:text-white border-b border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-blue-500 focus:outline-none px-1 py-0.5"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">HR Min (bpm)</label>
              <input
                type="number"
                value={zone.hr_min ?? ''}
                onChange={e => onChange(i, 'hr_min', e.target.value)}
                className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">HR Max (bpm)</label>
              <input
                type="number"
                value={zone.hr_max ?? ''}
                onChange={e => onChange(i, 'hr_max', e.target.value)}
                className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Power Min (W)</label>
              <input
                type="number"
                value={zone.power_min ?? ''}
                onChange={e => onChange(i, 'power_min', e.target.value)}
                className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Power Max (W)</label>
              <input
                type="number"
                value={zone.power_max ?? ''}
                onChange={e => onChange(i, 'power_max', e.target.value)}
                className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Pace Min ({paceUnit})</label>
              <input
                type="text"
                value={zone.pace_min ?? ''}
                onChange={e => onChange(i, 'pace_min', e.target.value)}
                className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Pace Max ({paceUnit})</label>
              <input
                type="text"
                value={zone.pace_max ?? ''}
                onChange={e => onChange(i, 'pace_max', e.target.value)}
                className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      ))}

      <div className="flex gap-3 pt-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex-1 px-4 py-2.5 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 rounded-lg font-semibold text-sm hover:bg-slate-700 dark:hover:bg-slate-100 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Zones'}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function zoneColor(zone: number): string {
  const colors: Record<number, string> = {
    1: 'bg-blue-400',
    2: 'bg-green-500',
    3: 'bg-yellow-500',
    4: 'bg-orange-500',
    5: 'bg-red-500'
  };
  return colors[zone] || 'bg-gray-400';
}

interface MetricCardProps {
  label: string;
  value: string;
  unit: string;
  badge?: string | null;
  color: 'blue' | 'green' | 'amber' | 'red' | 'slate';
}

function MetricCard({ label, value, unit, badge, color }: MetricCardProps) {
  const colorMap = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400',
    slate: 'bg-slate-50 dark:bg-slate-900/20 text-slate-700 dark:text-slate-300'
  };

  return (
    <div className={`rounded-xl p-3 ${colorMap[color]}`}>
      <p className="text-xs font-medium opacity-70 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      <p className="text-xs opacity-60">{unit}</p>
      {badge && (
        <span className="inline-block mt-1 px-1.5 py-0.5 bg-white/40 dark:bg-black/20 text-xs rounded">
          {badge}
        </span>
      )}
    </div>
  );
}

interface ThresholdCardProps {
  label: string;
  hr: number | null;
  power: number | null;
  pace: string | null;
  percentVo2?: number | null;
  percentHr?: number | null;
  confidence: string | null;
  sport: string;
  color: 'green' | 'amber' | 'red';
}

function ThresholdCard({ label, hr, power, pace, percentVo2, percentHr, confidence, sport, color }: ThresholdCardProps) {
  const colorMap = {
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    amber: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    red: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
  };
  const labelColorMap = {
    green: 'text-green-700 dark:text-green-400',
    amber: 'text-amber-700 dark:text-amber-400',
    red: 'text-red-700 dark:text-red-400'
  };

  return (
    <div className={`rounded-xl p-4 border ${colorMap[color]}`}>
      <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${labelColorMap[color]}`}>{label}</p>
      {hr && (
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-bold text-gray-900 dark:text-white">{hr}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">bpm</span>
        </div>
      )}
      {power && (
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{power}W</p>
      )}
      {pace && (
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">
          {pace} {sport === 'cycling' ? 'km/h' : sport === 'swimming' ? '/100m' : '/km'}
        </p>
      )}
      {(percentVo2 || percentHr) && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
          {percentVo2 && <p>{percentVo2}% VO2max</p>}
          {percentHr && <p>{percentHr}% HRmax</p>}
        </div>
      )}
      {confidence && (
        <span className="inline-block mt-2 px-1.5 py-0.5 bg-white/60 dark:bg-black/20 text-xs rounded text-gray-500 dark:text-gray-400">
          {confidence}
        </span>
      )}
    </div>
  );
}
