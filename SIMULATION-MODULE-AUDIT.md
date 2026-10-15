# Auditoría completa — Módulo "Simulation" (Metabolic Lab)

Documento de transferencia: todo lo necesario para replicar la sección **Simulation** en otro planner de Asciende, tal como está hoy (cálculos, referencias, datos, UI e idiomas).

---

## 1. Inventario de archivos

| Archivo | Líneas | Rol |
|---|---|---|
| `src/lib/simulationEngine.ts` | 558 | Motor de cálculo puro (sin React). 3 simuladores + formateadores |
| `src/lib/simulationProfile.ts` | 107 | Carga del perfil fisiológico del atleta desde la base de datos |
| `src/pages/SimulationPage.tsx` | 221 | Página contenedora: 5 pestañas + panel de 10 referencias científicas |
| `src/components/simulation/RaceSimulation.tsx` | 590 | Simulación de carrera (entrada, resultados, 5 gráficos, animación) |
| `src/components/simulation/InverseSimulation.tsx` | 327 | VO2max necesario para un tiempo objetivo + proyección semanal |
| `src/components/simulation/AltitudeSimulation.tsx` | 512 | Impacto fisiológico de la altitud (radar, PO2, aclimatación, zonas, recomendaciones) |
| `src/components/simulation/AltitudeBlockComparison.tsx` | 417 | Antes/después de un campo de altitud (compara 2 carreras simuladas) |
| `src/components/simulation/SimulationHistory.tsx` | 196 | Historial guardado (lee/escribe tabla `simulation_history`) |
| `src/contexts/LanguageContext.tsx` | — | 175 claves de traducción `sim.*` (EN/ES) |
| `supabase/migrations/20260314232428_add_simulation_history.sql` | 48 | Tabla + RLS + índices |

Ruteo: `App.tsx` importa `SimulationPage` y la monta cuando `currentView === 'simulation'`.

---

## 2. Tipos de datos (interfaces)

```ts
AthletePhysioProfile {
  vo2max: number;                 // ml/kg/min, requerido
  lt1_hr?, lt2_hr?: number|null;  // bpm
  lt1_pace?, lt2_pace?: string|null; // "min:seg/km"
  lt1_power?, lt2_power?: number|null; // W
  weight_kg?: number;             // default 70
  hr_max?: number;
  running_economy?: number;       // mlO2/kg/km
  lt1_vo2?, lt2_vo2?: number|null;
  fatmax_hr?: number|null;
}

RaceScenario {
  distance_km: number; name: string;
  targetPace_min_km: number;      // min/km decimal
  terrain: 'flat'|'rolling'|'hilly';
  temperature_c: number; humidity_percent: number; altitude_m: number;
  strategy: 'even'|'positive'|'negative';
}

AltitudeScenario { altitude_m; exposure_days; training_load: 'rest'|'light'|'moderate'|'hard'; }
```

Resultados: `RaceSimResult`, `AltitudeSimResult`, `InverseSimResult` (ver §4–§6).

---

## 3. Carga del perfil (`loadSimulationProfile`)

Orden de prioridad:

1. **Perfil fisiológico centralizado** (`fetchAthletePhysiologyProfile(athlete.id)` → tabla `athlete_physiology_profile`):
   - vo2max = `vo2max_relative_ml_kg_min` (fallback 50)
   - lt1/lt2 hr, power, pace, hrmax
   - `lt1_vo2` / `lt2_vo2` = (percent_vo2max/100) × vo2max
2. **Economía de carrera real**: busca el último `test_results` (de los últimos 5 tests `completed` con `vo2max` no nulo) y toma
   `advanced_metrics.movementEconomy.running.cost_per_km_ml_o2_kg`, válido si 150 < RE < 300.
3. **Fallback sin perfil centralizado**: último `test_results` con vo2max → vo2max, lt1_hr, lt2_hr, lt1_power, lt2_power, fatmax_hr, RE.
4. **Último recurso**: `{ vo2max: 50, weight_kg: athlete.weight_kg ?? 70 }`.

La UI también permite **editar el VO2max a mano** o escribirlo directamente sin atleta (default 50, peso 70).

`buildProfileSummary()` genera el resumen mostrado: LT1 bpm, LT2 bpm, LT2 pace, HRmax, RE.

---

## 4. SIMULADOR DE CARRERA — `simulateRace(profile, scenario)`

### 4.1 Factores de corrección

| Factor | Fórmula |
|---|---|
| Altitud | si alt > 1500 m: `1 − ((alt−1500)/1000) × 0.032` (≈ −3.2 % VO2max por 1000 m) |
| Temperatura | si T > 20 °C: `(T−20) × 0.002` (penalización al ritmo) |
| Humedad | si H > 60 %: `((H−60)/100) × 0.01` |
| Terreno | flat 1.0 · rolling 1.06 · hilly 1.13 |

```
pace_efectivo = targetPace × terreno × (1 + tempPenalty + humPenalty)
speed_m_s = 1000 / (pace_efectivo × 60)
VO2 (ml/kg/min) = speed_m_s × RE / 1000 × 60
%VO2max = VO2 / VO2max_efectivo × 100
tiempo_predicho = pace_efectivo × distancia
```

### 4.2 Economía de carrera estimada (si no hay medida)

| VO2max | RE (mlO2/kg/km) |
|---|---|
| >70 | 195 |
| >60 | 200 |
| >50 | 210 |
| >40 | 220 |
| ≤40 | 230 |

### 4.3 FC media

```
HRmax_est = hr_max ?? (lt2_hr ? round(lt2_hr / 0.92) : 185)
avgHR = round((%VO2max/100) × 0.85 × HRmax + HRmax × 0.15)
```

### 4.4 Energía y sustratos

```
kcal = peso × km × 1.05
% grasa: %VO2max <65 → 0.50 · <80 → 0.35 · ≥80 → 0.15
CHO_g = kcal × (1−%grasa) / 4        GRASAS_g = kcal × %grasa / 9
glucógeno = peso × 0.5 × 0.015 × 1000 + 100   (≈ 625 g a 70 kg)
CHO/km = CHO_g / km
bonk: si CHO_g > glucógeno → km_agotamiento = glucógeno / (CHO/km)
```

### 4.5 Deshidratación

```
sweatRate_L_h = 0.8 + (T−20)×0.03 + (H−50)×0.005
pérdida_L = sweatRate × horas
deshidratación_% = pérdida_L / (peso × 0.6) × 100
```

### 4.6 Distribución de zonas (% del tiempo, según %VO2max)

| %VO2max | Zonas |
|---|---|
| <65 | Z1-Z2 80 % · Z3 15 % · Z4+ 5 % |
| 65–78 | Z2 30 · Z3 45 · Z4 20 · Z5 5 |
| 78–90 | Z2 10 · Z3-Z4 35 · Z5 40 · Z6 15 |
| ≥90 | Z5 40 · Z6 40 · Z7 20 |

Colores: verde `#22c55e`, lima `#84cc16`, ámbar `#f59e0b`, rojo `#ef4444`, rojo oscuro `#dc2626`, granate `#991b1b`.

### 4.7 Estrategia (perfil km a km, máx. 20 pasos)

- **even**: ritmo constante.
- **positive**: `pace = base × (1 − 0.06 × (1−frac))` (rápido al inicio).
- **negative**: `pace = base × (1 + 0.04 × (1−frac))` (rápido al final).

### 4.8 Ritmo vs fatiga (km a km)

```
fatigueRate: %VO2max >88 → 0.18 · >78 → 0.10 · resto 0.05
fatigue = min(100, frac×fatigueRate×100 + deshid%×frac×3)
bonkPenalty = si km > km_bonk: fracPost × 0.15
strategyOffset: positive −0.04×(1−frac) · negative +0.03×(1−frac)
pace_drift = pace × (1 + fatigue/400 + bonkPenalty + strategyOffset)
hr_drift = round(avgHR × (1 + fatigue/300))
glucógeno_restante = max(0, glucógeno − CHOkm × km)
```

### 4.9 Lactato acumulado (km a km, base 1.0 mmol)

| %VO2max | Curva |
|---|---|
| <75 | + frac × 0.5 |
| 75–85 | + frac × 2.0 × (1/threshold); threshold: >78 → 0.80, resto 1.0 |
| ≥85 | + frac^1.5 × (6 si >95, si no 4) · tope 18 mmol |

### 4.10 Factibilidad

| %VO2max | Veredicto |
|---|---|
| ≤82 | optimal |
| 82–92 | challenging |
| 92–100 | limit |
| >100 | impossible |

### 4.11 Alertas (riskFlags) y recomendaciones

Alertas: %VO2max >95 (danger) / >88 (warning); deshidratación >3 % (warning) / >5 % (danger); CHO >300 g en ≥21 km (info); altitud >2500 m (warning con % de pérdida); T >30 °C (danger); bonk (danger con km); estrategia positive (warning).

Recomendaciones: bajar ritmo si %VO2max >85; beber ~`sweatRate×250` ml/h si deshidratación >2 %; ingestión de CHO (g/h) si >240 g; aclimatar si alt >1500; precooling si T >25; geles antes del km de bonk; trabajar RE si >215; elogiar estrategia negative. Si nada aplica: "todo en orden".

### 4.12 UI de Race (pestaña "Carrera")

- Selector de atleta (filtrado por rol: athlete→sus tests, coach→`coach_id`, admin→todos) + tarjeta de perfil editable (VO2max).
- Distancias: 1K, 5K, 10K, 21.0975, 42.195, 50K, 100K, custom.
- Ritmo objetivo "min:seg", terreno, estrategia (3 tarjetas), sliders T (−5..42), H (10..100), altitud (0..5000 m).
- Resultado: tarjeta de factibilidad + 8 métricas (%VO2max, FC media, kcal, CHO, grasas, deshidratación, RE, riesgo bonk).
- **Animación de progreso de carrera**: play/pause/repeat, barra de km, 4 tarjetas en vivo (km, ritmo, FC, fatiga), 300 ms por paso.
- **5 gráficos (Recharts)**: Pace+HR (Area), Lactato con líneas LT1 ~2 mmol / LT2 ~4 mmol, Zonas (Bar horizontal), Estrategia (Composed pace + %VO2max), Glucógeno restante con línea de "Bonk km".
- Botón **Guardar** → tabla `simulation_history`.

---

## 5. SIMULADOR INVERSO — `simulateInverse(targetTime_min, scenario, currentVO2max)`

Dado un tiempo objetivo, calcula el VO2max necesario:

```
targetPace = tiempo / km
mismas correcciones de terreno/temperatura/humedad/altitud
RE estimada: VO2max >60 → 200 · >50 → 210 · resto 220
VO2_necesario = speed × RE / 1000 × 60
VO2max_requerido = VO2_necesario / altitudeFactor
gap = VO2max_requerido − VO2max_actual
ritmo_actual_sostenible = 1 / ((VO2max × altFactor × 0.85) / (RE/1000) / 60)   // al 85 % VO2max
```

**Proyección de entrenamiento** (semanas 4, 8, 12, 16, 20, 24):

```
ganancia = semanas × 0.25 ml/kg/min   (asunción fija mostrada en UI)
VO2max_proyectado = actual + ganancia
tiempo_proyectado = 1 / ((VO2proj × altFactor × 0.85)/(RE/1000)/60) × km
```

Comentarios de factibilidad por gap: ≤0 (ya lo tenés) · <3 (alcanzable a corto plazo) · <8 (exigente, 3-6 meses) · ≥8 (muy difícil / largo plazo).

UI: distancia (5K–50K + custom), tiempo objetivo h:m:s, terreno, altitud (0–4000 m), 3 números grandes (requerido / actual / gap), gráfico de proyección con línea de objetivo, tabla semana a semana (VO2max, tiempo, ritmo, diferencia, "objetivo alcanzado").

---

## 6. SIMULADOR DE ALTITUD — `simulateAltitude(profile, scenario)`

```
PO2_alv = round((159 × exp(−alt/7400) − 6) × 0.7)
SpO2: <1500→98 · <2500→95 · <3500→91 · <5000→85 · resto 78
reducción_VO2max_% : <1500 → 0 · si no ((alt−1500)/100) × 0.32   (≈0.32 %/100 m)
VO2max_ajustado = VO2max × (1 − red%/100)
aumento_FC = round(alt/1000 × 3.5) bpm
aumento_ventilación = round(alt/1000 × 12) %
pérdida_rendimiento = reducción_VO2max × 0.9
```

**Cronograma de aclimatación** (día 0..min(exposición,28)):

```
adapt = 1 − exp(−día/8)
recup_VO2max = min(adapt×70, 70) %
aumento_RBC = min(día/21 × 8, 8) %
recup_rendimiento = min(adapt×65, 65) %
```

**Zonas de altitud** (tabla informativa con colores): 0–1500 (0 %), 1500–2500 (1-7 %), 2500–3500 (7-14 %), 3500–5000 (14-30 %), 5000+ (>30 %, "zona de la muerte").

**Alertas**: >2500 moderado (warning) · >3500 riesgo AMS (danger) · >4000 + carga hard (danger) · SpO2 <90 (danger) · exposición <3 días a >2500 (info) · 21+ días a 2200–3000 → LHTL positivo (info).

**Recomendaciones**: protocolo LHTL si 2000–3000; hidratación; reducir carga de entrenamiento (−15-25 %, o 40-50 % si >3000; series más cortas `alt/100×2` s); hierro/ferritina; recuperación si ≥14 días; monitoreo médico si SpO2 <90; nutrición (CHO + hierro).

**UI**: presets de destinos conocidos, sliders altitud (0–6000) y días (1–28), carga de entrenamiento (rest/light/moderate/hard), 6 métricas resumen, alertas, radar de impacto (VO2max, SpO2, rendimiento, control FC, PO2 alveolar, ventilación), barras de PO2/SpO2, lista de respuestas compensatorias (EPO 24-48 h, 2,3-DPG 2-3 días, eritropoyesis 7-14 días, volumen globular 14-21 días), tabs de aclimatación, zonas y recomendaciones.

---

## 7. COMPARADOR DE BLOQUE DE ALTITUD — `AltitudeBlockComparison`

Presets: Sierra Nevada 2320 · Font Romeu 1850 · Flagstaff 2106 · St. Moritz 1856 · Iten 2400 · Bogotá 2625.

Lógica:

```
1. simulateAltitude(alt, días, 'moderate')
2. boost_VO2max = (RBC_final%/100) × VO2max × 0.5
   VO2max_post = VO2max + boost
3. simulateRace ANTES (VO2max base, nivel del mar, terreno flat, 18 °C, 55 %)
4. simulateRace DESPUÉS (VO2max_post, mismas condiciones)
5. ahorro_min = tiempo_antes − tiempo_después
6. ritmo_óptimo_regreso: si %VO2max carrera post < 0.82 → pace × 0.96, si no pace
```

Guarda en historial con `simulation_type: 'altitude'`, resumen: `postBlockVO2max`, `vo2maxBoost`, `timeSaving_min`, `optimalReturnPace`.

UI: carreras de referencia 5K/10K/21K/42K + ritmo objetivo, gráfico de barras Antes/Después (VO2max, %VO2max carrera, FC media), gráfico de línea del VO2max durante el bloque, tarjetas resumen.

---

## 8. Base de datos

Tabla `simulation_history` (migración `20260314232428_add_simulation_history.sql`):

```sql
CREATE TABLE simulation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid REFERENCES athletes(id) ON DELETE SET NULL,
  simulation_type text NOT NULL CHECK (simulation_type IN ('race','altitude')),
  label text NOT NULL DEFAULT '',
  input_params jsonb NOT NULL DEFAULT '{}',   -- parámetros del escenario
  result_summary jsonb NOT NULL DEFAULT '{}', -- métricas clave para la lista
  created_at timestamptz DEFAULT now()
);
ALTER TABLE simulation_history ENABLE ROW LEVEL SECURITY;
-- Políticas SELECT/INSERT/DELETE abiertas a anon + authenticated (patrón de la app)
-- Índices: athlete_id, created_at DESC
```

`input_params` (race): `{ distanceKm, targetPaceStr, terrain, temperature, humidity, altitude, strategy, vo2max }`.
`result_summary` (race): `{ predictedTime_min, percentVO2max, feasibility, carbsUsed_g, bonkRisk, glycogenDepletionKm, runningEconomy }`.

Historial con filtrado por rol (athlete/coach/admin) y borrado individual. Sin edición.

---

## 9. Dependencias técnicas

- **Recharts**: AreaChart, LineChart, BarChart, ComposedChart, RadarChart, ReferenceLine, etc.
- **Supabase JS** (`src/lib/supabase.ts`): lecturas de `athletes`, `test_results`, `athlete_physiology_profile` (vía `physiologyProfile.ts`), escritura en `simulation_history`.
- **LanguageContext**: `t()` y `tGlobal()` (el motor usa `tGlobal` para textos dentro de resultados). **Ojo al portar**: los mensajes del motor salen traducidos en el momento del cálculo; si el otro planner no tiene el contexto de idioma, hay que sustituir `tGlobal(...)` por textos fijos.
- Sin librerías extra: todo lo demás es TypeScript puro.

---

## 10. Referencias científicas (panel de la página, 10 citas)

1. **Joyner & Coyle (2008)** — J Physiol 586(1):35–44. VO2max, economía y umbral como determinantes del rendimiento. Base del modelo de ritmo basado en RE.
2. **Faude et al. (2009)** — Sports Med 39(6):469–490. Conceptos de umbral de lactato (LT1/LT2). Base de las zonas.
3. **Margaria et al. (1963) / Daniels (1985)** — J Appl Physiol 18:367; Sports Med 2:176. RE como mlO2/kg/km. Fórmula `v = VO2max × 1000 / (RE × 60)`.
4. **Sawka et al. (2007) / ACSM** — Med Sci Sports Exerc 39(2):377–390. Sudoración 0.4–2.5 L/h; deterioro >2–3 % de masa corporal. Base de deshidratación.
5. **Burke et al. (2011)** — J Sports Sci 29(S1):S17–S27. Glucógeno 400–600 g. Base del bonk.
6. **West (2004)** — Ann Intern Med 141(10):789–800. PO2 alveolar y caída de VO2max ~0.32 %/100 m sobre 1500 m.
7. **Levine & Stray-Gundersen (1997)** — J Appl Physiol 83(1):102–112. LHTL: altitud óptima 2200–3000 m, ventana de competición 7–21 días.
8. **Stöggl & Sperlich (2014)** — Front Physiol 5:33. Distribución polarizada de zonas.
9. **Noakes (2003)** — Lore of Running 4ª ed. Estrategia positive/negative y cinética de lactato/glucógeno.
10. **Borg (1970) / Impellizzeri et al. (2004)** — RPE y carga por FC. Deriva de FC como indicador de fatiga.

---

## 11. Internacionalización

175 claves `sim.*` en `LanguageContext.tsx` (EN/ES), cubriendo: athlete, race params, distancias, terreno, estrategias, factibilidad, métricas, alertas (`sim.risk.*`), recomendaciones (`sim.rec.*`), zonas (`sim.zone.*`), altitud (`sim.altitude.*` con subgrupos risk/rec), inverso (`sim.inverse.*`), bloque (`sim.altBlock.*`), historial.

Para portar sin el LanguageContext: o se copia el diccionario `sim.*` completo, o se reemplazan las llamadas `tGlobal('...')` en `simulationEngine.ts` por strings literales.

---

## 12. Puntos de acoplamiento con el resto de la app (para desacoplar en Asciende)

1. `physiologyProfile.ts` → `fetchAthletePhysiologyProfile(athleteId)` (tabla `athlete_physiology_profile`).
2. `test_results.advanced_metrics.movementEconomy.running.cost_per_km_ml_o2_kg` → economía real.
3. `athletes` (nombre, peso, `hub_user_id`, `coach_id`) → selector y filtrado por rol.
4. `AuthContext` → rol (`trainer` se normaliza a `coach`) y `hub_user_id`.
5. `LanguageContext` → traducciones.

Todo lo demás (el 100 % de los cálculos) es autocontenido en `simulationEngine.ts`: se puede copiar ese archivo tal cual y solo reemplazar `tGlobal`.
