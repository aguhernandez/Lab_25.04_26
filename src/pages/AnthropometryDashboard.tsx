import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import KerrBodyCompositionDashboard from '../components/anthropometry/KerrBodyCompositionDashboard';
import type { AnthropometryMeasurement, KerrResults } from '../types/anthropometry.types';
import { Users, TrendingUp, Activity, Search } from 'lucide-react';

export default function AnthropometryDashboard() {
  const { profile } = useAuth();
  const [allMeasurements, setAllMeasurements] = useState<AnthropometryMeasurement[]>([]);
  const [allResults, setAllResults] = useState<KerrResults[]>([]);
  const [athletes, setAthletes] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAthlete, setSelectedAthlete] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      loadDashboardData();
    }
  }, [profile?.id]);

  const loadDashboardData = async () => {
    setLoading(true);

    try {
      const effectiveRole = profile?.role === 'trainer' ? 'coach' : profile?.role;
      const isAdmin = effectiveRole === 'admin';
      const isTrainer = effectiveRole === 'coach';

      let measurementsQuery = supabase
        .from('anthropometry_measurements')
        .select('*')
        .order('measurement_date', { ascending: false });

      if (!isAdmin && !isTrainer) {
        measurementsQuery = measurementsQuery.eq('athlete_id', profile?.id);
      }

      const { data: measurements, error: measurementsError } = await measurementsQuery;

      if (measurementsError) throw measurementsError;

      setAllMeasurements(measurements || []);

      const { data: results, error: resultsError } = await supabase
        .from('anthropometry_kerr_results')
        .select('*')
        .order('calculation_date', { ascending: false });

      if (resultsError) throw resultsError;

      setAllResults(results || []);

      const uniqueAthleteIds = [...new Set(measurements?.map(m => m.athlete_id) || [])];

      const { data: athleteProfiles, error: athleteError } = await supabase
        .from('profiles')
        .select('id, full_name, email, sex, birth_date')
        .in('id', uniqueAthleteIds);

      if (athleteError) throw athleteError;

      setAthletes(athleteProfiles || []);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAthletes = athletes.filter(athlete =>
    athlete.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    athlete.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalAthletes = athletes.length;
  const totalMeasurements = allMeasurements.length;
  const avgBodyMass = allMeasurements.length > 0
    ? allMeasurements.reduce((sum, m) => sum + (m.body_mass_kg_median || 0), 0) / allMeasurements.length
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Anthropometry Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Athletes</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{totalAthletes}</p>
            </div>
            <Users className="w-12 h-12 text-blue-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Measurements</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{totalMeasurements}</p>
            </div>
            <TrendingUp className="w-12 h-12 text-green-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Avg Body Mass</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{avgBodyMass.toFixed(1)} kg</p>
            </div>
            <Activity className="w-12 h-12 text-purple-500" />
          </div>
        </div>
      </div>

      <KerrBodyCompositionDashboard allResults={allResults} />

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mt-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Athletes</h2>
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search athletes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        <div className="space-y-4">
          {filteredAthletes.map((athlete) => {
            const athleteMeasurements = allMeasurements.filter(m => m.athlete_id === athlete.id);
            const athleteResults = allResults.filter(r => r.athlete_id === athlete.id);
            const latestResult = athleteResults[0];

            return (
              <div
                key={athlete.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                onClick={() => setSelectedAthlete(athlete.id === selectedAthlete ? null : athlete.id)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {athlete.full_name || athlete.email}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {athleteMeasurements.length} measurement{athleteMeasurements.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  {latestResult && (
                    <div className="text-right">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Latest BMI</div>
                      <div className="text-xl font-bold text-gray-900 dark:text-white">
                        {latestResult.bmi.toFixed(1)}
                      </div>
                    </div>
                  )}
                </div>

                {selectedAthlete === athlete.id && latestResult && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Adipose</div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {latestResult.adipose_mass_kg.toFixed(1)} kg
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Muscle</div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {latestResult.muscle_mass_kg.toFixed(1)} kg
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Bone</div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {latestResult.bone_mass_kg.toFixed(1)} kg
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">M/B Ratio</div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {latestResult.muscle_bone_ratio.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Ballast</div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {latestResult.ballast_index.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
