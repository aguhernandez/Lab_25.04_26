import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { loadAnthropometryFromHub } from '../../lib/anthropometry';
import { LabSession, PreTestData, OutdoorWeather } from '../../lib/labSession';
import { AnthropometryData } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  geocodeCity,
  getElevationFromCoords,
  fetchCurrentWeather,
  getBrowserLocation,
  GeocodingResult,
} from '../../lib/weatherService';

interface Props {
  session: LabSession;
  onUpdate: (updates: Partial<LabSession>) => void;
  onNext: () => void;
  onBack: () => void;
}

interface AthleteProfile {
  vo2max: number | null;
  lt1_hr: number | null;
  lt2_hr: number | null;
  last_test_date: string | null;
}

export default function LabPhasePretest({ session, onUpdate, onNext, onBack }: Props) {
  const { t } = useLanguage();
  const athlete = session.athlete!;
  const [anthropometry, setAnthropometry] = useState<AnthropometryData | null>(null);
  const [profile, setProfile] = useState<AthleteProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [usg, setUsg] = useState('');
  const [hrRest, setHrRest] = useState('');
  const [hrv, setHrv] = useState('');
  const [basalLactate, setBasalLactate] = useState('');
  const [rmr, setRmr] = useState('');

  const [testTime, setTestTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [cityInput, setCityInput] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [citySuggestions, setCitySuggestions] = useState<GeocodingResult[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<GeocodingResult | null>(null);
  const [elevation, setElevation] = useState<number | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const [outdoorWeather, setOutdoorWeather] = useState<OutdoorWeather | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  const [indoorTemp, setIndoorTemp] = useState('');
  const [indoorHumidity, setIndoorHumidity] = useState('');
  const [indoorNotes, setIndoorNotes] = useState('');

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadData();
  }, [athlete.id]);

  useEffect(() => {
    if (!citySearch || citySearch.length < 2) {
      setCitySuggestions([]);
      return;
    }
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(async () => {
      try {
        const results = await geocodeCity(citySearch);
        setCitySuggestions(results);
      } catch {
        setCitySuggestions([]);
      }
    }, 400);
  }, [citySearch]);

  const loadData = async () => {
    try {
      const status = await loadAnthropometryFromHub(athlete.id);
      if (status.data) {
        setAnthropometry(status.data);
        setWeight(String(status.data.weight_kg || ''));
        setHeight(String(status.data.height_cm || ''));
        setBodyFat(String(status.data.bodyFatPercent || ''));
      } else {
        setWeight(String(athlete.weight_kg || ''));
        setHeight(String(athlete.height_cm || ''));
        setBodyFat(String(athlete.body_fat_percent || ''));
      }

      const { data: profileData } = await supabase
        .from('athlete_physiology_profiles')
        .select('vo2max, lt1_hr, lt2_hr, updated_at')
        .eq('athlete_id', athlete.id)
        .maybeSingle();

      if (profileData) {
        setProfile({
          vo2max: profileData.vo2max,
          lt1_hr: profileData.lt1_hr,
          lt2_hr: profileData.lt2_hr,
          last_test_date: profileData.updated_at,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCity = async (result: GeocodingResult) => {
    setSelectedLocation(result);
    setCityInput(result.name + (result.admin1 ? `, ${result.admin1}` : '') + `, ${result.country}`);
    setCitySearch('');
    setCitySuggestions([]);
    setElevation(result.elevation ?? null);

    if (result.elevation == null) {
      try {
        const elev = await getElevationFromCoords(result.latitude, result.longitude);
        setElevation(elev);
      } catch {
        setElevation(null);
      }
    }

    await loadWeather(result.latitude, result.longitude);
  };

  const handleBrowserLocation = async () => {
    setGeoLoading(true);
    setGeoError(null);
    try {
      const coords = await getBrowserLocation();
      const results = await geocodeCity(`${coords.latitude},${coords.longitude}`);
      if (results.length > 0) {
        await handleSelectCity(results[0]);
      } else {
        const elev = await getElevationFromCoords(coords.latitude, coords.longitude);
        setElevation(elev);
        await loadWeather(coords.latitude, coords.longitude);
        setCityInput(`${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error de ubicación';
      setGeoError(msg);
    } finally {
      setGeoLoading(false);
    }
  };

  const loadWeather = async (lat: number, lon: number) => {
    setWeatherLoading(true);
    setWeatherError(null);
    try {
      const weather = await fetchCurrentWeather(lat, lon);
      setOutdoorWeather(weather);
    } catch {
      setWeatherError('No se pudo obtener el clima actual');
    } finally {
      setWeatherLoading(false);
    }
  };

  const getLBM = () => {
    const w = parseFloat(weight);
    const bf = parseFloat(bodyFat);
    if (!isNaN(w) && !isNaN(bf) && bf > 0 && bf < 100) {
      return (w * (1 - bf / 100)).toFixed(1);
    }
    return null;
  };

  const getAge = () => {
    if (!athlete.date_of_birth) return null;
    return new Date().getFullYear() - new Date(athlete.date_of_birth).getFullYear();
  };

  const handleConfirm = () => {
    const w = parseFloat(weight);
    const h = parseFloat(height);
    const bf = parseFloat(bodyFat) || undefined;
    const age = getAge() || 25;
    const sex = athlete.sex || anthropometry?.sex || 'male';
    const lbm = getLBM();

    const anthro: AnthropometryData = {
      weight_kg: isNaN(w) ? (athlete.weight_kg || 70) : w,
      height_cm: isNaN(h) ? (athlete.height_cm || 170) : h,
      age,
      sex,
      bodyFatPercent: bf,
      leanBodyMassKg: lbm ? parseFloat(lbm) : undefined,
      source: 'manual',
    };

    const cityLabel = cityInput.trim() || null;

    const preTest: PreTestData = {
      anthropometry: anthro,
      test_time: testTime || null,
      city: cityLabel,
      elevation_m: elevation,
      outdoor_weather: outdoorWeather,
      indoor_temp_c: indoorTemp ? parseFloat(indoorTemp) : null,
      indoor_humidity_percent: indoorHumidity ? parseFloat(indoorHumidity) : null,
      indoor_conditions_notes: indoorNotes.trim() || null,
      usg: usg ? parseFloat(usg) : null,
      hr_rest: hrRest ? parseInt(hrRest) : null,
      hrv_ms: hrv ? parseFloat(hrv) : null,
      basal_lactate: basalLactate ? parseFloat(basalLactate) : null,
      rmr_kcal: rmr ? parseFloat(rmr) : null,
    };

    onUpdate({ preTestData: preTest });
    onNext();
  };

  const canProceed = weight !== '' && height !== '';

  const inputClass = "w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('pretest.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{athlete.name} · {session.sport}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400 text-sm">{t('pretest.loadingData')}</div>
      ) : (
        <>
          {profile && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide mb-2">{t('pretest.lastProfile')}</p>
              <div className="flex flex-wrap gap-4 text-sm">
                {profile.vo2max && <span className="text-gray-700 dark:text-gray-300">VO₂max: <strong>{profile.vo2max} ml/kg/min</strong></span>}
                {profile.lt1_hr && <span className="text-gray-700 dark:text-gray-300">LT1: <strong>{profile.lt1_hr} bpm</strong></span>}
                {profile.lt2_hr && <span className="text-gray-700 dark:text-gray-300">LT2: <strong>{profile.lt2_hr} bpm</strong></span>}
                {profile.last_test_date && (
                  <span className="text-gray-500 dark:text-gray-400 text-xs">
                    {t('pretest.lastUpdated')} {new Date(profile.last_test_date).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('pretest.anthropometry')}</h2>
              {anthropometry && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">{t('pretest.autoLoaded')}</p>
              )}
            </div>
            <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>{t('pretest.weightRequired')}</label>
                <input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} placeholder="e.g. 72" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('pretest.heightRequired')}</label>
                <input type="number" step="1" value={height} onChange={e => setHeight(e.target.value)} placeholder="e.g. 175" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('pretest.bodyFat')}</label>
                <input type="number" step="0.1" value={bodyFat} onChange={e => setBodyFat(e.target.value)} placeholder="optional" className={inputClass} />
              </div>
              {getLBM() && (
                <div className="col-span-full">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('pretest.lbm')} <strong className="text-gray-900 dark:text-white">{getLBM()} kg</strong>
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Contexto del Test</h2>
              <p className="text-xs text-gray-400 mt-0.5">Hora, lugar y condiciones del día</p>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Hora del test</label>
                  <input
                    type="time"
                    value={testTime}
                    onChange={e => setTestTime(e.target.value)}
                    className={inputClass}
                  />
                </div>
                {elevation != null && (
                  <div className="flex flex-col justify-end">
                    <p className={labelClass}>Altitud detectada</p>
                    <div className="flex items-center gap-2 px-3 py-2 bg-sky-50 dark:bg-sky-900/20 rounded-lg border border-sky-200 dark:border-sky-700">
                      <svg className="w-4 h-4 text-sky-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21l9-18 9 18H3z" />
                      </svg>
                      <span className="text-sm font-semibold text-sky-700 dark:text-sky-300">{elevation} m.s.n.m.</span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className={labelClass}>Ciudad / Ubicación</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={cityInput}
                      onChange={e => {
                        setCityInput(e.target.value);
                        setCitySearch(e.target.value);
                        if (!e.target.value) {
                          setSelectedLocation(null);
                          setElevation(null);
                          setOutdoorWeather(null);
                        }
                      }}
                      placeholder="Ej: Buenos Aires, Madrid..."
                      className={inputClass}
                    />
                    {citySuggestions.length > 0 && (
                      <ul className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg overflow-hidden">
                        {citySuggestions.map((s, i) => (
                          <li
                            key={i}
                            onClick={() => handleSelectCity(s)}
                            className="px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-0"
                          >
                            <span className="font-medium">{s.name}</span>
                            {s.admin1 && <span className="text-gray-500 dark:text-gray-400">, {s.admin1}</span>}
                            <span className="text-gray-400 dark:text-gray-500"> · {s.country}</span>
                            {s.elevation != null && (
                              <span className="ml-2 text-xs text-sky-500">{s.elevation} m</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleBrowserLocation}
                    disabled={geoLoading}
                    title="Usar mi ubicación"
                    className="flex items-center justify-center w-10 h-9 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-300 transition-colors disabled:opacity-50 flex-shrink-0"
                  >
                    {geoLoading ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
                {geoError && <p className="text-xs text-red-500 mt-1">{geoError}</p>}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Condiciones Meteorológicas Exteriores</h2>
                <p className="text-xs text-gray-400 mt-0.5">Datos obtenidos automáticamente según la ubicación</p>
              </div>
              {selectedLocation && (
                <button
                  type="button"
                  onClick={() => loadWeather(selectedLocation.latitude, selectedLocation.longitude)}
                  disabled={weatherLoading}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 flex items-center gap-1"
                >
                  {weatherLoading ? (
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  Actualizar
                </button>
              )}
            </div>
            <div className="p-6">
              {weatherLoading && (
                <p className="text-sm text-gray-400 text-center py-2">Obteniendo datos meteorológicos...</p>
              )}
              {weatherError && !weatherLoading && (
                <p className="text-sm text-red-500">{weatherError}</p>
              )}
              {!selectedLocation && !weatherLoading && !outdoorWeather && (
                <p className="text-sm text-gray-400 italic">Selecciona una ciudad para obtener el clima actual.</p>
              )}
              {outdoorWeather && !weatherLoading && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <WeatherStat
                    icon={<TempIcon />}
                    label="Temperatura"
                    value={outdoorWeather.temperature_c != null ? `${outdoorWeather.temperature_c.toFixed(1)} °C` : '—'}
                  />
                  <WeatherStat
                    icon={<HumidIcon />}
                    label="Humedad"
                    value={outdoorWeather.humidity_percent != null ? `${outdoorWeather.humidity_percent}%` : '—'}
                  />
                  <WeatherStat
                    icon={<WindIcon />}
                    label="Viento"
                    value={outdoorWeather.wind_speed_kmh != null ? `${outdoorWeather.wind_speed_kmh.toFixed(1)} km/h` : '—'}
                  />
                  <WeatherStat
                    icon={<PressureIcon />}
                    label="Presión"
                    value={outdoorWeather.pressure_hpa != null ? `${outdoorWeather.pressure_hpa.toFixed(0)} hPa` : '—'}
                  />
                  {outdoorWeather.description && (
                    <div className="col-span-full">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Condición: <span className="font-medium text-gray-700 dark:text-gray-300">{outdoorWeather.description}</span>
                      </p>
                      {outdoorWeather.fetched_at && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Actualizado: {new Date(outdoorWeather.fetched_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Condiciones Internas del Laboratorio</h2>
              <p className="text-xs text-gray-400 mt-0.5">Ingreso manual de las condiciones ambientales del laboratorio</p>
            </div>
            <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Temperatura Lab (°C)</label>
                <input
                  type="number"
                  step="0.5"
                  value={indoorTemp}
                  onChange={e => setIndoorTemp(e.target.value)}
                  placeholder="e.g. 22"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Humedad Lab (%)</label>
                <input
                  type="number"
                  step="1"
                  min={0}
                  max={100}
                  value={indoorHumidity}
                  onChange={e => setIndoorHumidity(e.target.value)}
                  placeholder="e.g. 55"
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-3">
                <label className={labelClass}>Notas del entorno (opcional)</label>
                <textarea
                  value={indoorNotes}
                  onChange={e => setIndoorNotes(e.target.value)}
                  rows={2}
                  placeholder="Ej: Ventilación activa, aire acondicionado a 20°C, sin luz solar directa..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('pretest.preExerciseStatus')}</h2>
              <p className="text-xs text-gray-400 mt-0.5">{t('pretest.preExerciseDesc')}</p>
            </div>
            <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>{t('pretest.restingHR')}</label>
                <input type="number" value={hrRest} onChange={e => setHrRest(e.target.value)} placeholder="e.g. 52" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('pretest.hrv')}</label>
                <input type="number" value={hrv} onChange={e => setHrv(e.target.value)} placeholder="optional" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('pretest.usg')}</label>
                <input type="number" step="0.001" value={usg} onChange={e => setUsg(e.target.value)} placeholder="e.g. 1.015" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('pretest.basalLactate')}</label>
                <input type="number" step="0.1" value={basalLactate} onChange={e => setBasalLactate(e.target.value)} placeholder="e.g. 0.9" className={inputClass} />
                <p className="text-xs text-gray-400 mt-1">{t('pretest.basalLactateHint')}</p>
              </div>
              <div>
                <label className={labelClass}>{t('pretest.rmr')}</label>
                <input type="number" step="1" value={rmr} onChange={e => setRmr(e.target.value)} placeholder="e.g. 1850" className={inputClass} />
                <p className="text-xs text-gray-400 mt-1">{t('pretest.rmrHint')}</p>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="flex justify-between items-center">
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          {t('pretest.back')}
        </button>
        <div className="flex gap-3">
          <button
            onClick={onNext}
            className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {t('pretest.skip')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canProceed || loading}
            className={`px-8 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm ${
              canProceed && !loading
                ? 'bg-[#fdda36] text-[#514163] hover:bg-[#fdda36]/90'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
          >
            {t('pretest.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

function WeatherStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
      <div className="text-blue-500 flex-shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-sm font-semibold text-gray-800 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

function TempIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
    </svg>
  );
}

function HumidIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0l-3-3m3 3l3-3" />
    </svg>
  );
}

function WindIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
    </svg>
  );
}

function PressureIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
