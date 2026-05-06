import { OutdoorWeather } from './labSession';

export interface GeocodingResult {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string;
  elevation?: number;
}

const WMO_DESCRIPTIONS: Record<number, string> = {
  0: 'Despejado',
  1: 'Mayormente despejado',
  2: 'Parcialmente nublado',
  3: 'Nublado',
  45: 'Neblina',
  48: 'Neblina con escarcha',
  51: 'Llovizna ligera',
  53: 'Llovizna moderada',
  55: 'Llovizna densa',
  61: 'Lluvia ligera',
  63: 'Lluvia moderada',
  65: 'Lluvia intensa',
  71: 'Nevada ligera',
  73: 'Nevada moderada',
  75: 'Nevada intensa',
  80: 'Chubascos ligeros',
  81: 'Chubascos moderados',
  82: 'Chubascos intensos',
  95: 'Tormenta eléctrica',
  96: 'Tormenta con granizo',
  99: 'Tormenta con granizo intenso',
};

export async function geocodeCity(cityName: string): Promise<GeocodingResult[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=5&language=es&format=json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Error al buscar la ciudad');
  const data = await response.json();
  return (data.results ?? []) as GeocodingResult[];
}

export async function getElevationFromCoords(latitude: number, longitude: number): Promise<number | null> {
  try {
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${latitude}&longitude=${longitude}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    return data.elevation?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function fetchCurrentWeather(latitude: number, longitude: number): Promise<OutdoorWeather> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,surface_pressure,weather_code&wind_speed_unit=kmh&timezone=auto`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Error al obtener el clima');
  const data = await response.json();
  const current = data.current;
  const weatherCode = current?.weather_code ?? null;

  return {
    temperature_c: current?.temperature_2m ?? null,
    humidity_percent: current?.relative_humidity_2m ?? null,
    wind_speed_kmh: current?.wind_speed_10m ?? null,
    pressure_hpa: current?.surface_pressure ?? null,
    weather_code: weatherCode,
    description: weatherCode != null ? (WMO_DESCRIPTIONS[weatherCode] ?? `Código ${weatherCode}`) : null,
    fetched_at: new Date().toISOString(),
  };
}

export async function getBrowserLocation(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalización no disponible en este navegador'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => reject(new Error(`Error de geolocalización: ${err.message}`)),
      { timeout: 10000, enableHighAccuracy: false }
    );
  });
}

export function formatWeatherDescription(weather: OutdoorWeather): string {
  const parts: string[] = [];
  if (weather.temperature_c != null) parts.push(`${weather.temperature_c.toFixed(1)}°C`);
  if (weather.humidity_percent != null) parts.push(`HR: ${weather.humidity_percent}%`);
  if (weather.wind_speed_kmh != null) parts.push(`Viento: ${weather.wind_speed_kmh.toFixed(1)} km/h`);
  if (weather.pressure_hpa != null) parts.push(`${weather.pressure_hpa.toFixed(0)} hPa`);
  if (weather.description) parts.push(weather.description);
  return parts.join(' · ');
}
