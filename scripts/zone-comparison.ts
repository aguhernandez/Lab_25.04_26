/**
 * Standalone comparison: OLD zone logic vs. NEW proposed unified logic.
 * Not imported anywhere — run with: npx tsx scripts/zone-comparison.ts
 */

// ---- Sample test data: cycling ramp test with power ----
const cyclingPoints = [
  { stage: 1, hr: 110, power: 100, pace: null },
  { stage: 2, hr: 125, power: 150, pace: null },
  { stage: 3, hr: 140, power: 200, pace: null },
  { stage: 4, hr: 152, power: 250, pace: null },  // ~LT1
  { stage: 5, hr: 165, power: 300, pace: null },
  { stage: 6, hr: 172, power: 350, pace: null },  // ~LT2
  { stage: 7, hr: 178, power: 400, pace: null },
  { stage: 8, hr: 183, power: 430, pace: null },  // near max
];
const cyclingHRmax = 185;
const cyclingLT1hr = 152;
const cyclingLT2hr = 172;
const cyclingPAM = 430; // max power from test

// ---- Sample test data: running step test with pace ----
const runningPoints = [
  { stage: 1, hr: 115, power: null, pace: '8:00' },
  { stage: 2, hr: 130, power: null, pace: '7:00' },
  { stage: 3, hr: 145, power: null, pace: '6:00' },
  { stage: 4, hr: 155, power: null, pace: '5:30' },  // ~LT1
  { stage: 5, hr: 165, power: null, pace: '5:00' },
  { stage: 6, hr: 173, power: null, pace: '4:30' },  // ~LT2
  { stage: 7, hr: 178, power: null, pace: '4:10' },
  { stage: 8, hr: 182, power: null, pace: '3:55' },  // near VAM
];
const runningHRmax = 185;
const runningLT1hr = 155;
const runningLT2hr = 173;
const runningVAMpace = '3:55'; // fastest pace from test

// ---- Helpers ----
function paceToKmh(pace: string): number {
  const parts = pace.replace(/[^0-9:]/g, '').split(':');
  const mins = parseInt(parts[0]);
  const secs = parseInt(parts[1]);
  return 60 / (mins + secs / 60);
}
function kmhToPace(kmh: number): string {
  const minsPerKm = 60 / kmh;
  const m = Math.floor(minsPerKm);
  const s = Math.round((minsPerKm - m) * 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
function interpolateHR(pCurrent: number, pLow: number, pHigh: number, hrLow: number, hrHigh: number): number {
  if (pHigh === pLow) return hrLow;
  const ratio = Math.max(0, Math.min(1, (pCurrent - pLow) / (pHigh - pLow)));
  return Math.round(hrLow + ratio * (hrHigh - hrLow));
}

// ---- OLD calculateZones7 (from trainingZones.ts) ----
function oldZones7Cycling(lt1hr: number, lt2hr: number, hrmax: number, points: typeof cyclingPoints) {
  const lt1 = lt1hr;
  const lt2 = lt2hr;
  const midLT = Math.round((lt1 + lt2) / 2);
  const hr90max = Math.round(hrmax * 0.90);
  const maxPower = Math.max(...points.map(p => p.power!));
  const lt1Power = points.find(p => p.hr >= lt1)?.power ?? maxPower * 0.55;
  const lt2Power = points.find(p => p.hr >= lt2)?.power ?? maxPower * 0.75;

  return [
    { z: 1, hr: `${Math.round(hrmax*0.50)}-${Math.round(lt1*0.90)}`, pwr: `${Math.round(maxPower*0.35)}-${Math.round(lt1Power*0.85)}` },
    { z: 2, hr: `${Math.round(lt1*0.90)+1}-${lt1}`, pwr: `${Math.round(lt1Power*0.85)+1}-${Math.round(lt1Power*0.97)}` },
    { z: 3, hr: `${lt1+1}-${midLT}`, pwr: `${Math.round(lt1Power*0.97)+1}-${Math.round((lt1Power+lt2Power)/2*0.99)}` },
    { z: 4, hr: `${midLT+1}-${lt2}`, pwr: `${Math.round((lt1Power+lt2Power)/2*0.99)+1}-${Math.round(lt2Power)}` },
    { z: 5, hr: `${lt2+1}-${hr90max}`, pwr: `${Math.round(lt2Power)+1}-${Math.round(lt2Power*1.08)}` },
    { z: 6, hr: `${hr90max+1}-${hrmax}`, pwr: `${Math.round(lt2Power*1.08)+1}-${Math.round(maxPower*1.05)}` },
    { z: 7, hr: `${hrmax+1}-${hrmax+15}`, pwr: `${Math.round(maxPower*1.05)+1}-${Math.round(maxPower*1.30)}` },
  ];
}

function oldZones7Running(lt1hr: number, lt2hr: number, hrmax: number, points: typeof runningPoints) {
  const lt1 = lt1hr;
  const lt2 = lt2hr;
  const midLT = Math.round((lt1 + lt2) / 2);
  const hr90max = Math.round(hrmax * 0.90);
  const pacePts = points.filter(p => p.pace);
  const lt1Pace = pacePts.reduce((prev, curr) => Math.abs(curr.hr - lt1) < Math.abs(prev.hr - lt1) ? curr : prev).pace;
  const lt2Pace = pacePts.reduce((prev, curr) => Math.abs(curr.hr - lt2) < Math.abs(prev.hr - lt2) ? curr : prev).pace;

  return [
    { z: 1, hr: `${Math.round(hrmax*0.50)}-${Math.round(lt1*0.90)}`, pace: `—-${lt1Pace}` },
    { z: 2, hr: `${Math.round(lt1*0.90)+1}-${lt1}`, pace: `${lt1Pace}-${lt1Pace}` },
    { z: 3, hr: `${lt1+1}-${midLT}`, pace: `${lt1Pace}-${lt2Pace}` },
    { z: 4, hr: `${midLT+1}-${lt2}`, pace: `${lt2Pace}-${lt2Pace}` },
    { z: 5, hr: `${lt2+1}-${hr90max}`, pace: `${lt2Pace}-—` },
    { z: 6, hr: `${hr90max+1}-${hrmax}`, pace: `—-—` },
    { z: 7, hr: `${hrmax+1}-${hrmax+15}`, pace: `—-—` },
  ];
}

// ---- OLD calculateTrainingZones (5 zones, from physiology.ts) ----
function oldZones5Cycling(lt1hr: number, lt2hr: number, hrmax: number, points: typeof cyclingPoints) {
  const lt1 = lt1hr;
  const lt2 = lt2hr;
  const maxPower = Math.max(...points.map(p => p.power!));
  const lt1Power = points.find(p => p.hr >= lt1)?.power ?? maxPower * 0.55;
  const lt2Power = points.find(p => p.hr >= lt2)?.power ?? maxPower * 0.75;

  return [
    { z: 1, hr: `${Math.round(hrmax*0.50)}-${lt1}`, pwr: `${Math.round(maxPower*0.40)}-${Math.round(lt1Power*0.90)}` },
    { z: 2, hr: `${lt1+1}-${Math.round(lt1*1.05)}`, pwr: `${Math.round(lt1Power*0.90)+1}-${Math.round(lt1Power*1.05)}` },
    { z: 3, hr: `${Math.round(lt1*1.05)+1}-${lt2}`, pwr: `${Math.round(lt1Power*1.05)+1}-${Math.round(lt2Power*0.95)}` },
    { z: 4, hr: `${lt2+1}-${Math.round(lt2*1.05)}`, pwr: `${Math.round(lt2Power*0.95)+1}-${Math.round(lt2Power*1.05)}` },
    { z: 5, hr: `${Math.round(lt2*1.05)+1}-${hrmax}`, pwr: `${Math.round(lt2Power*1.05)+1}-${Math.round(maxPower*1.20)}` },
  ];
}

// ---- NEW unified 7-zone logic ----
interface NewZone {
  z: number;
  hr: string;
  pwr?: string;
  pace?: string;
}

function newZones7Cycling(lt1hr: number, lt2hr: number, hrmax: number, points: typeof cyclingPoints, pam: number): NewZone[] {
  const lt1 = lt1hr;
  const lt2 = lt2hr;
  const mid = (lt1 + lt2) / 2;
  const maxPower = Math.max(...points.map(p => p.power!));
  const lt1Power = points.find(p => p.hr >= lt1)?.power ?? maxPower * 0.55;
  const lt2Power = points.find(p => p.hr >= lt2)?.power ?? maxPower * 0.75;
  const midPower = (lt1Power + lt2Power) / 2;
  const z5MaxPower = Math.round(lt2Power * 1.05);
  const z6MaxPower = pam; // 100% PAM
  const z7MaxPower = Math.round(pam * 1.30);
  const z7MinPower = Math.round(pam * 1.05);

  // Derive HR for Z5/Z6 by linear interpolation between (LT2_power, LT2_hr) and (PAM, HRmax)
  const z5MaxHR = interpolateHR(z5MaxPower, lt2Power, pam, lt2, hrmax);
  const z6MaxHR = hrmax; // at PAM = 100%, HR = HRmax

  return [
    { z: 1, hr: `${Math.round(hrmax*0.50)}-${Math.round(lt1*0.90)}`, pwr: `${Math.round(maxPower*0.35)}-${Math.round(lt1Power*0.90)}` },
    { z: 2, hr: `${Math.round(lt1*0.90)+1}-${lt1}`, pwr: `${Math.round(lt1Power*0.90)+1}-${Math.round(lt1Power)}` },
    { z: 3, hr: `${lt1+1}-${Math.round(mid)}`, pwr: `${Math.round(lt1Power)+1}-${Math.round(midPower)}` },
    { z: 4, hr: `${Math.round(mid)+1}-${lt2}`, pwr: `${Math.round(midPower)+1}-${Math.round(lt2Power)}` },
    { z: 5, hr: `${lt2+1}-${z5MaxHR}`, pwr: `${Math.round(lt2Power)+1}-${z5MaxPower}` },
    { z: 6, hr: `${z5MaxHR+1}-${z6MaxHR}`, pwr: `${z5MaxPower+1}-${z6MaxPower}` },
    { z: 7, hr: `—`, pwr: `${z7MinPower}-${z7MaxPower}` },
  ];
}

function newZones7Running(lt1hr: number, lt2hr: number, hrmax: number, points: typeof runningPoints, vamPace: string): NewZone[] {
  const lt1 = lt1hr;
  const lt2 = lt2hr;
  const mid = (lt1 + lt2) / 2;
  const pacePts = points.filter(p => p.pace);
  const lt1PacePt = pacePts.reduce((prev, curr) => Math.abs(curr.hr - lt1) < Math.abs(prev.hr - lt1) ? curr : prev);
  const lt2PacePt = pacePts.reduce((prev, curr) => Math.abs(curr.hr - lt2) < Math.abs(prev.hr - lt2) ? curr : prev);
  const lt1Speed = paceToKmh(lt1PacePt.pace!);
  const lt2Speed = paceToKmh(lt2PacePt.pace!);
  const midSpeed = (lt1Speed + lt2Speed) / 2;
  const vamSpeed = paceToKmh(vamPace);

  // 105% of LT2 speed (faster)
  const z5MaxSpeed = lt2Speed * 1.05;
  const z6MaxSpeed = vamSpeed; // 100% VAM
  const z7MinSpeed = vamSpeed * 1.05;
  const z7MaxSpeed = vamSpeed * 1.30;

  // Derive HR by interpolating between (LT2_speed, LT2_hr) and (VAM_speed, HRmax)
  const z5MaxHR = interpolateHR(z5MaxSpeed, lt2Speed, vamSpeed, lt2, hrmax);
  const z6MaxHR = hrmax;

  return [
    { z: 1, hr: `${Math.round(hrmax*0.50)}-${Math.round(lt1*0.90)}`, pace: `${kmhToPace(lt1Speed*0.90)}- slower than ${kmhToPace(lt1Speed)}` },
    { z: 2, hr: `${Math.round(lt1*0.90)+1}-${lt1}`, pace: `${kmhToPace(lt1Speed)}-${kmhToPace(lt1Speed)}` },
    { z: 3, hr: `${lt1+1}-${Math.round(mid)}`, pace: `${kmhToPace(lt1Speed)}-${kmhToPace(midSpeed)}` },
    { z: 4, hr: `${Math.round(mid)+1}-${lt2}`, pace: `${kmhToPace(midSpeed)}-${kmhToPace(lt2Speed)}` },
    { z: 5, hr: `${lt2+1}-${z5MaxHR}`, pace: `${kmhToPace(lt2Speed)}-${kmhToPace(z5MaxSpeed)}` },
    { z: 6, hr: `${z5MaxHR+1}-${z6MaxHR}`, pace: `${kmhToPace(z5MaxSpeed)}-${kmhToPace(z6MaxSpeed)}` },
    { z: 7, hr: `—`, pace: `${kmhToPace(z7MinSpeed)}-${kmhToPace(z7MaxSpeed)}` },
  ];
}

// ---- Print results ----
function printTable(title: string, rows: NewZone[]) {
  console.log(`\n${title}`);
  console.log('─'.repeat(70));
  for (const r of rows) {
    const pwr = r.pwr ? ` | PWR: ${r.pwr}W` : '';
    const pace = r.pace ? ` | PACE: ${r.pace}` : '';
    console.log(`  Z${r.z}: HR ${r.hr} bpm${pwr}${pace}`);
  }
}

console.log('='.repeat(70));
console.log('TRAINING ZONE COMPARISON: OLD vs NEW');
console.log('='.repeat(70));

console.log('\n\n###### CYCLING TEST (power-based) ######');
console.log(`HRmax=${cyclingHRmax}, LT1_hr=${cyclingLT1hr}, LT2_hr=${cyclingLT2hr}, PAM=${cyclingPAM}W`);

printTable('OLD — calculateZones7 (7 zones, table display)', oldZones7Cycling(cyclingLT1hr, cyclingLT2hr, cyclingHRmax, cyclingPoints));
printTable('OLD — calculateTrainingZones (5 zones, persisted to passport)', oldZones5Cycling(cyclingLT1hr, cyclingLT2hr, cyclingHRmax, cyclingPoints));
printTable('NEW — unified 7 zones (anchored to power + VAM/PAM)', newZones7Cycling(cyclingLT1hr, cyclingLT2hr, cyclingHRmax, cyclingPoints, cyclingPAM));

console.log('\n\n###### RUNNING TEST (pace-based) ######');
console.log(`HRmax=${runningHRmax}, LT1_hr=${runningLT1hr}, LT2_hr=${runningLT2hr}, VAM=${runningVAMpace}/km`);

printTable('OLD — calculateZones7 (7 zones, table display)', oldZones7Running(runningLT1hr, runningLT2hr, runningHRmax, runningPoints));
printTable('NEW — unified 7 zones (anchored to pace + VAM)', newZones7Running(runningLT1hr, runningLT2hr, runningHRmax, runningPoints, runningVAMpace));

console.log('\n\n' + '='.repeat(70));
console.log('KEY DIFFERENCES (Z5-Z7 only, Z1-Z4 unchanged):');
console.log('='.repeat(70));
console.log(`
OLD Z5 (cycling): HR ${cyclingLT2hr+1}-${Math.round(cyclingHRmax*0.90)} | PWR ends at 108% LT2
NEW Z5 (cycling): HR ${cyclingLT2hr+1}-${interpolateHR(Math.round(350*1.05), 350, 430, 172, 185)} | PWR ends at 105% LT2 (365W)

OLD Z6 (cycling): HR ${Math.round(cyclingHRmax*0.90)+1}-${cyclingHRmax} | PWR 108% LT2 → 105% Pmax
NEW Z6 (cycling): HR ${interpolateHR(Math.round(350*1.05), 350, 430, 172, 185)+1}-${cyclingHRmax} | PWR 105% LT2 → 100% PAM (430W)

OLD Z7 (cycling): HR ${cyclingHRmax+1}-${cyclingHRmax+15} | PWR 105% Pmax → 130% Pmax
NEW Z7 (cycling): HR — (no HR) | PWR 105% PAM → 130% PAM (452-559W)

OLD Z5 (running): HR ${runningLT2hr+1}-${Math.round(runningHRmax*0.90)} | PACE: no upper bound
NEW Z5 (running): HR ${runningLT2hr+1}-${interpolateHR(paceToKmh('4:30')*1.05, paceToKmh('4:30'), paceToKmh('3:55'), 173, 185)} | PACE: 4:30 → ${kmhToPace(paceToKmh('4:30')*1.05)}

OLD Z6 (running): HR ${Math.round(runningHRmax*0.90)+1}-${runningHRmax} | PACE: none
NEW Z6 (running): HR ${interpolateHR(paceToKmh('4:30')*1.05, paceToKmh('4:30'), paceToKmh('3:55'), 173, 185)+1}-${runningHRmax} | PACE: ${kmhToPace(paceToKmh('4:30')*1.05)} → 3:55

OLD Z7 (running): HR ${runningHRmax+1}-${runningHRmax+15} | PACE: none
NEW Z7 (running): HR — (no HR) | PACE: ${kmhToPace(paceToKmh('3:55')*1.05)} → ${kmhToPace(paceToKmh('3:55')*1.30)}
`);
