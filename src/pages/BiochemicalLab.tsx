import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Athlete } from '../types';
import { DOMAINS, analyzeFullPanel, getDomainTrends, BiochemicalResult, DomainTrend } from '../lib/biochemistry';
import AthleteSelector from '../components/AthleteSelector';
import BiochemicalInput from '../components/biochemical/BiochemicalInput';
import BiochemicalResults from '../components/biochemical/BiochemicalResults';
import BiochemicalTrends from '../components/biochemical/BiochemicalTrends';

type TabId = 'input' | 'results' | 'trends';

export interface BiochemicalTest {
  id: string;
  athlete_id: string;
  test_date: string;
  oxygen_transport: Record<string, number>;
  recovery: Record<string, number>;
  inflammation: Record<string, number>;
  hormonal: Record<string, number>;
  energy_availability: Record<string, number>;
  nutrition: Record<string, number>;
  metabolic_health: Record<string, number>;
  hydration_renal: Record<string, number>;
  oxygen_transport_score: number | null;
  recovery_score: number | null;
  inflammation_score: number | null;
  hormonal_score: number | null;
  energy_availability_score: number | null;
  nutrition_score: number | null;
  metabolic_health_score: number | null;
  hydration_renal_score: number | null;
  global_score: number | null;
  health_flags: unknown[];
  notes: string | null;
  created_at: string;
}

export default function BiochemicalLab() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const isAthlete = profile?.role === 'athlete';
  const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('input');
  const [tests, setTests] = useState<BiochemicalTest[]>([]);
  const [latestResult, setLatestResult] = useState<BiochemicalResult | null>(null);
  const [trends, setTrends] = useState<DomainTrend[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAthlete && profile?.hub_user_id) {
      supabase
        .from('athletes')
        .select('*')
        .eq('hub_user_id', profile.hub_user_id)
        .maybeSingle()
        .then(({ data: a }) => { if (a) setSelectedAthlete(a as Athlete); });
    }
  }, [isAthlete, profile]);

  useEffect(() => {
    if (selectedAthlete) loadTests(selectedAthlete.id);
  }, [selectedAthlete?.id]);

  const loadTests = async (athleteId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('biochemical_tests')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('test_date', { ascending: false });

    const records = (data || []) as BiochemicalTest[];
    setTests(records);

    if (records.length > 0) {
      const latest = records[0];
      const allMarkers: Record<string, Record<string, number>> = {};
      for (const domain of DOMAINS) {
        const markers = latest[domain.key as keyof BiochemicalTest];
        if (markers && typeof markers === 'object' && !Array.isArray(markers)) {
          allMarkers[domain.key] = markers as Record<string, number>;
        }
      }
      setLatestResult(analyzeFullPanel(allMarkers));
      setTrends(getDomainTrends(records as unknown as Array<{ test_date: string; [key: string]: unknown }>));
    } else {
      setLatestResult(null);
      setTrends([]);
    }
    setLoading(false);
  };

  const handleSaved = () => {
    if (selectedAthlete) {
      loadTests(selectedAthlete.id);
      setActiveTab('results');
    }
  };

  if (!isAthlete && !selectedAthlete) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900 dark:text-white">{t('bio.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('bio.subtitle')}</p>
        </div>
        <AthleteSelector onSelectAthlete={setSelectedAthlete} />
      </div>
    );
  }

  if (!selectedAthlete) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 rounded-full border-2 border-[#fdda36] border-t-transparent animate-spin" />
      </div>
    );
  }

  const tabs: { id: TabId; labelKey: string }[] = [
    { id: 'input', labelKey: 'bio.tab.input' },
    { id: 'results', labelKey: 'bio.tab.results' },
    { id: 'trends', labelKey: 'bio.tab.trends' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900 dark:text-white">{t('bio.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{selectedAthlete.name}</p>
        </div>
        {!isAthlete && (
          <button
            onClick={() => setSelectedAthlete(null)}
            className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400"
          >
            {t('bio.changeAthlete')}
          </button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-[#fdda36] text-[#514163]'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 rounded-full border-2 border-[#fdda36] border-t-transparent animate-spin" />
        </div>
      ) : (
        <>
          {activeTab === 'input' && (
            <BiochemicalInput athleteId={selectedAthlete.id} onSaved={handleSaved} />
          )}
          {activeTab === 'results' && (
            <BiochemicalResults result={latestResult} tests={tests} />
          )}
          {activeTab === 'trends' && (
            <BiochemicalTrends trends={trends} tests={tests} />
          )}
        </>
      )}
    </div>
  );
}
