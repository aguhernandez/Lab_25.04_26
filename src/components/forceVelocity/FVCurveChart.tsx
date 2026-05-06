import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { FVProfile, FVRepResult, generateFVCurvePoints } from '../../lib/forceVelocity';

interface FVCurveChartProps {
  profile: FVProfile;
  reps: FVRepResult[];
  showPower?: boolean;
  previousProfile?: FVProfile | null;
}

const LOAD_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

function getLoadColor(loadKg: number, allLoads: number[]): string {
  const sorted = [...new Set(allLoads)].sort((a, b) => a - b);
  const idx = sorted.indexOf(loadKg) % LOAD_COLORS.length;
  return LOAD_COLORS[idx];
}

export default function FVCurveChart({ profile, reps, showPower = true, previousProfile }: FVCurveChartProps) {
  const curvePoints = generateFVCurvePoints(profile, 80);
  const prevCurvePoints = previousProfile ? generateFVCurvePoints(previousProfile, 80) : [];

  const allLoads = reps.map(r => r.load_kg);
  const validReps = reps.filter(r => r.is_valid);

  const scatterData = validReps.map(r => ({
    velocity: r.mean_velocity_ms,
    force: r.mean_force_n,
    power: r.mean_power_w,
    load: r.load_kg,
    set: r.set_number,
    rep: r.rep_number,
    color: getLoadColor(r.load_kg, allLoads),
  }));

  const chartData = curvePoints.map((pt, i) => ({
    velocity: pt.velocity,
    force: pt.force,
    power: pt.power,
    prevForce: prevCurvePoints[i]?.force ?? null,
    prevPower: prevCurvePoints[i]?.power ?? null,
  }));

  const customDot = (props: { cx?: number; cy?: number; payload?: { color?: string } }) => {
    const { cx, cy, payload } = props;
    if (!cx || !cy) return <g />;
    return (
      <circle
        cx={cx}
        cy={cy}
        r={5}
        fill={payload?.color || '#3b82f6'}
        stroke="white"
        strokeWidth={1.5}
      />
    );
  };

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { velocity: number; force: number; power: number } }> }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 shadow-lg text-xs">
        <p className="font-semibold text-gray-900 dark:text-white mb-1">v = {d.velocity?.toFixed(3)} m/s</p>
        <p className="text-blue-600 dark:text-blue-400">Force: {d.force?.toFixed(0)} N</p>
        {showPower && <p className="text-amber-600 dark:text-amber-400">Power: {d.power?.toFixed(0)} W</p>}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
          <XAxis
            dataKey="velocity"
            label={{ value: 'Velocity (m/s)', position: 'insideBottom', offset: -5, style: { fontSize: 11, fill: '#6b7280' } }}
            tick={{ fontSize: 10, fill: '#6b7280' }}
            domain={[0, 'dataMax']}
          />
          <YAxis
            yAxisId="force"
            label={{ value: 'Force (N)', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11, fill: '#3b82f6' } }}
            tick={{ fontSize: 10, fill: '#3b82f6' }}
          />
          {showPower && (
            <YAxis
              yAxisId="power"
              orientation="right"
              label={{ value: 'Power (W)', angle: 90, position: 'insideRight', offset: 10, style: { fontSize: 11, fill: '#f59e0b' } }}
              tick={{ fontSize: 10, fill: '#f59e0b' }}
            />
          )}
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />

          <Line
            yAxisId="force"
            type="monotone"
            dataKey="force"
            stroke="#3b82f6"
            strokeWidth={2.5}
            dot={false}
            name="F-V Curve"
          />

          {previousProfile && (
            <Line
              yAxisId="force"
              type="monotone"
              dataKey="prevForce"
              stroke="#93c5fd"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              dot={false}
              name="Previous F-V"
            />
          )}

          {showPower && (
            <Line
              yAxisId="power"
              type="monotone"
              dataKey="power"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              name="Power Curve"
              strokeDasharray="4 2"
            />
          )}

          <Scatter
            yAxisId="force"
            data={scatterData}
            dataKey="force"
            name="Measured reps"
            shape={customDot}
          />

          <ReferenceLine
            yAxisId="force"
            x={profile.optimal_velocity}
            stroke="#10b981"
            strokeDasharray="6 3"
            label={{ value: 'Vopt', position: 'top', style: { fontSize: 10, fill: '#10b981' } }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap gap-2 mt-1">
        {[...new Set(allLoads)].sort((a, b) => a - b).map((load) => (
          <span
            key={load}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: getLoadColor(load, allLoads) }}
          >
            {load} kg
          </span>
        ))}
      </div>
    </div>
  );
}
