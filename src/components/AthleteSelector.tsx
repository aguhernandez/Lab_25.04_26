import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Athlete } from '../types';
import { searchHubProfilesByEmail, isHubLinkingEnabled, HubProfile } from '../lib/hubLink';
import { Users, RefreshCw, ChevronRight, Search } from 'lucide-react';

interface AthleteSelectorProps {
  onSelectAthlete: (athlete: Athlete) => void;
  onCreateNew?: () => void;
}

export default function AthleteSelector({ onSelectAthlete }: AthleteSelectorProps) {
  const { profile } = useAuth();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [hubProfiles, setHubProfiles] = useState<HubProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchingHub, setSearchingHub] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [athletesWithMeasurements, setAthletesWithMeasurements] = useState<Set<string>>(new Set());
  const hubEnabled = isHubLinkingEnabled();

  useEffect(() => {
    loadAthletes();
  }, [profile]);

  useEffect(() => {
    if (hubEnabled && searchTerm.includes('@')) {
      searchHub();
    } else {
      setHubProfiles([]);
    }
  }, [searchTerm, hubEnabled]);

  const searchHub = async () => {
    setSearchingHub(true);
    try {
      const profiles = await searchHubProfilesByEmail(searchTerm);
      const { data: localProfiles } = await supabase
        .from('profiles')
        .select('hub_user_id')
        .not('hub_user_id', 'is', null);
      const linkedHubIds = new Set((localProfiles || []).map(p => p.hub_user_id));
      setHubProfiles(profiles.filter(p => !linkedHubIds.has(p.id)));
    } catch (err) {
      console.error('HUB search error:', err);
    } finally {
      setSearchingHub(false);
    }
  };

  const loadAthletes = async () => {
    try {
      setLoading(true);
      let query = supabase.from('athletes').select('*').order('name', { ascending: true });
      const effectiveRole = profile?.role === 'trainer' ? 'coach' : profile?.role;
      if (effectiveRole === 'coach' && profile?.id) {
        query = query.eq('coach_id', profile.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      const athleteList = data || [];
      setAthletes(athleteList);

      // Check which athletes have actual anthropometry measurements
      if (athleteList.length > 0) {
        const ids = athleteList.map(a => a.id);
        const { data: measurements } = await supabase
          .from('anthropometry_measurements')
          .select('athlete_id')
          .in('athlete_id', ids);
        const withData = new Set((measurements || []).map(m => m.athlete_id));
        setAthletesWithMeasurements(withData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load athletes');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectHubProfile = async (hubProfile: HubProfile) => {
    try {
      const { data: existingAthlete } = await supabase
        .from('athletes')
        .select('*')
        .eq('hub_user_id', hubProfile.id)
        .maybeSingle();

      if (existingAthlete) {
        onSelectAthlete(existingAthlete);
        return;
      }

      const { data, error } = await supabase
        .from('athletes')
        .insert({
          name: hubProfile.full_name || hubProfile.email || 'Unknown',
          email: hubProfile.email,
          sport: 'cycling',
          hub_user_id: hubProfile.id,
          coach_id: profile?.id || null,
        })
        .select()
        .single();

      if (error) {
        setError(`Failed to link HUB profile: ${error.message}`);
        return;
      }
      if (data) onSelectAthlete(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link HUB profile');
    }
  };

  const calculateAge = (dob?: string) => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  };

  const filteredAthletes = athletes.filter(athlete => {
    const s = searchTerm.toLowerCase();
    return athlete.name.toLowerCase().includes(s) || athlete.email?.toLowerCase().includes(s);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 rounded-full border-2 border-[#fdda36] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-8 border border-red-200 dark:border-red-800">
        <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
        <button onClick={loadAthletes} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900 dark:text-white">Select Athlete</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {hubEnabled ? 'Search HUB users by email or select an existing athlete' : 'Choose an athlete to continue'}
          </p>
        </div>
        <button
          onClick={loadAthletes}
          className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm text-gray-600 dark:text-gray-400"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder={hubEnabled ? "Search by name or email (@ to search HUB)..." : "Search by name or email..."}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-500"
        />
      </div>

      {searchingHub && (
        <div className="text-center py-4 text-sm text-gray-400">Searching HUB...</div>
      )}

      {hubProfiles.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            HUB Profiles ({hubProfiles.length})
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hubProfiles.map(hp => (
              <div
                key={hp.id}
                onClick={() => handleSelectHubProfile(hp)}
                className="group bg-white dark:bg-gray-800 rounded-2xl border border-blue-200 dark:border-blue-800 overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
              >
                <div className="bg-gradient-to-r from-blue-700 to-blue-600 px-5 py-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-white/80" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-white truncate">{hp.full_name || 'No Name'}</h3>
                    <p className="text-xs text-white/60 truncate">{hp.email}</p>
                  </div>
                </div>
                <div className="px-5 py-3 flex items-center justify-between">
                  <span className="text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-lg border border-blue-200 dark:border-blue-800">HUB Profile</span>
                  <div className="flex items-center text-sm font-semibold text-blue-600 dark:text-blue-400 group-hover:gap-1 transition-all">
                    Link & Select
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {filteredAthletes.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Athletes ({filteredAthletes.length})
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAthletes.map(athlete => {
              const age = calculateAge(athlete.date_of_birth);
              const hasData = athletesWithMeasurements.has(athlete.id) || !!(athlete.weight_kg && athlete.height_cm);
              return (
                <div
                  key={athlete.id}
                  onClick={() => onSelectAthlete(athlete)}
                  className="group bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
                >
                  <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                      <Users className="w-5 h-5 text-white/80" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-white truncate">{athlete.name}</h3>
                      {age && <p className="text-xs text-white/60">{age} years · <span className="capitalize">{athlete.sport}</span></p>}
                    </div>
                  </div>
                  <div className="px-5 py-3 flex items-center justify-between">
                    <div className="flex gap-1.5">
                      {athlete.sex && (
                        <span className="text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-lg capitalize">{athlete.sex}</span>
                      )}
                      <span className={`text-xs font-medium px-2 py-1 rounded-lg ${hasData ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'}`}>
                        {hasData ? 'Data ready' : 'No measurements'}
                      </span>
                    </div>
                    <div className="flex items-center text-sm font-semibold text-slate-600 dark:text-[#fdda36] group-hover:gap-1 transition-all">
                      Select
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : hubProfiles.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-16 text-center">
          <div className="w-14 h-14 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users className="w-7 h-7 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {searchTerm ? 'No athletes found' : 'No athletes yet'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {searchTerm ? 'Try a different search term' : 'Create athletes in the Athletes section first.'}
          </p>
        </div>
      )}
    </div>
  );
}
