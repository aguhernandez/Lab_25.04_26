import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { HydrationProfile, HydrationSessionRecord, getStressBgColor, getUsgColor } from '../../lib/hydration';

interface HydrationProfileCardProps {
  athleteId: string;
}

export default function HydrationProfileCard({ athleteId }: HydrationProfileCardProps) {
  const [profile, setProfile] = useState<HydrationProfile | null>(null);
  const [sessions, setSessions] = useState<HydrationSessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'summary' | 'history'>('summary');

  useEffect(() => {
    load();
  }, [athleteId]);

  const load = async () => {
    try {
      setLoading(true);
      const [profileRes, sessionsRes] = await Promise.all([
        supabase.from('athlete_hydration_profiles').select('*').eq('athlete_id', athleteId).maybeSingle(),
        supabase.from('athlete_hydration_sessions').select('*').eq('athlete_id', athleteId).order('session_date', { ascending: false }).limit(10),
      ]);
      setProfile(profileRes.data);
      setSessions(sessionsRes.data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Hydration & Thermoregulation</h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Hydration & Thermoregulation</h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">No hydration assessments recorded yet. Run the Hydration Lab to start tracking.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Hydration & Thermoregulation</h3>
          <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">{profile.total_sessions} session{profile.total_sessions !== 1 ? 's' : ''}</span>
        </div>

        {(profile.performance_risk || profile.hydration_warning) && (
          <div className={`rounded-lg p-3 flex gap-2 ${profile.performance_risk ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'}`}>
            <svg className={`w-4 h-4 flex-shrink-0 mt-0.5 ${profile.performance_risk ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className={`text-xs ${profile.performance_risk ? 'text-red-700 dark:text-red-300' : 'text-yellow-700 dark:text-yellow-300'}`}>
              {profile.performance_risk || profile.hydration_warning}
            </p>
          </div>
        )}

        <div className="flex border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden mt-3">
          {(['summary', 'history'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-sm font-medium transition-colors capitalize ${
                activeTab === tab
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {tab === 'summary' ? 'Summary' : 'History'}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {activeTab === 'summary' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Avg Sweat Rate</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">
                  {profile.average_sweat_rate_l_h?.toFixed(3)}
                  <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">L/h</span>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Max Dehydration</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">
                  {profile.max_observed_dehydration_percent?.toFixed(2)}
                  <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">%</span>
                </div>
              </div>
              {profile.baseline_usg && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-center">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Baseline USG</div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">{profile.baseline_usg.toFixed(3)}</div>
                  {profile.classification_pre_session && (
                    <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${getUsgColor(profile.classification_pre_session)}`}>
                      {profile.classification_pre_session}
                    </span>
                  )}
                </div>
              )}
            </div>

            {profile.last_session_date && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Last Session</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(profile.last_session_date)}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Dehydration: </span>
                    <span className="font-medium text-gray-900 dark:text-white">{profile.last_percent_dehydration?.toFixed(2)}%</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Sweat Rate: </span>
                    <span className="font-medium text-gray-900 dark:text-white">{profile.last_sweat_rate_l_h?.toFixed(3)} L/h</span>
                  </div>
                  {profile.last_temperature_c && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Temp: </span>
                      <span className="font-medium text-gray-900 dark:text-white">{profile.last_temperature_c}°C</span>
                    </div>
                  )}
                  {profile.last_humidity_percent && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Humidity: </span>
                      <span className="font-medium text-gray-900 dark:text-white">{profile.last_humidity_percent}%</span>
                    </div>
                  )}
                  {profile.last_classification && (
                    <div className="col-span-2">
                      <span className="text-gray-500 dark:text-gray-400">Risk: </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStressBgColor(profile.last_classification)}`}>
                        {profile.last_classification}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-3">
            {sessions.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No sessions recorded yet.</p>
            ) : (
              sessions.map(session => (
                <div key={session.id} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatDate(session.session_date)}</span>
                    {session.stress_classification && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStressBgColor(session.stress_classification)}`}>
                        {session.stress_classification}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Dehydration</div>
                      <div className="font-medium text-gray-900 dark:text-white">{session.percent_dehydration?.toFixed(2)}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Sweat Rate</div>
                      <div className="font-medium text-gray-900 dark:text-white">{session.sweat_rate_l_h?.toFixed(3)} L/h</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">HSS</div>
                      <div className="font-medium text-gray-900 dark:text-white">{session.hydration_stress_score?.toFixed(2)}</div>
                    </div>
                    {session.temperature_c && (
                      <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Temp</div>
                        <div className="font-medium text-gray-900 dark:text-white">{session.temperature_c}°C</div>
                      </div>
                    )}
                    {session.humidity_percent && (
                      <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Humidity</div>
                        <div className="font-medium text-gray-900 dark:text-white">{session.humidity_percent}%</div>
                      </div>
                    )}
                    {session.usg_pre && (
                      <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">USG Pre</div>
                        <div className="font-medium text-gray-900 dark:text-white">{session.usg_pre.toFixed(3)}</div>
                      </div>
                    )}
                    {session.usg_post && (
                      <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">USG Post</div>
                        <div className="font-medium text-gray-900 dark:text-white">{session.usg_post.toFixed(3)}</div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
