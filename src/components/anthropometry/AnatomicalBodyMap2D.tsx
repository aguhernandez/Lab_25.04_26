import { useState } from 'react';
import type { KerrResults } from '../../types/anthropometry.types';

interface AnatomicalBodyMap2DProps {
  measurements?: Record<string, any>;
  kerrResults?: KerrResults | null;
  sex?: 'male' | 'female';
}

interface Segment {
  id: string;
  labelMuscle: string;
  labelAdipose: string;
  muscleField: keyof KerrResults;
  adiposeField: keyof KerrResults;
  anchorXpct: number;
  anchorYpct: number;
  side: 'left' | 'right';
}

const SEGMENTS: Segment[] = [
  {
    id: 'arm',
    labelMuscle: 'Sup. muscular brazo',
    labelAdipose: 'Sup. adiposa brazo',
    muscleField: 'cross_section_arm_muscle',
    adiposeField: 'cross_section_arm_adipose',
    anchorXpct: 18,
    anchorYpct: 37,
    side: 'left',
  },
  {
    id: 'forearm',
    labelMuscle: 'Sup. muscular antebrazo',
    labelAdipose: 'Sup. adiposa antebrazo',
    muscleField: 'cross_section_arm_muscle',
    adiposeField: 'cross_section_arm_adipose',
    anchorXpct: 14,
    anchorYpct: 51,
    side: 'left',
  },
  {
    id: 'abdomen',
    labelMuscle: 'Sup. residual abdominal',
    labelAdipose: 'Sup. adiposa abdominal',
    muscleField: 'cross_section_thigh_muscle',
    adiposeField: 'cross_section_thigh_adipose',
    anchorXpct: 50,
    anchorYpct: 46,
    side: 'right',
  },
  {
    id: 'thigh',
    labelMuscle: 'Sup. muscular muslo',
    labelAdipose: 'Sup. adiposa muslo',
    muscleField: 'cross_section_thigh_muscle',
    adiposeField: 'cross_section_thigh_adipose',
    anchorXpct: 60,
    anchorYpct: 64,
    side: 'right',
  },
  {
    id: 'calf',
    labelMuscle: 'Sup. muscular pantorrilla',
    labelAdipose: 'Sup. adiposa pantorrilla',
    muscleField: 'cross_section_calf_muscle',
    adiposeField: 'cross_section_calf_adipose',
    anchorXpct: 60,
    anchorYpct: 80,
    side: 'right',
  },
];

export default function AnatomicalBodyMap2D({ kerrResults, sex = 'female' }: AnatomicalBodyMap2DProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const getSectionData = (s: Segment) => {
    if (!kerrResults) return null;
    const muscle = Number(kerrResults[s.muscleField] ?? 0);
    const adipose = Number(kerrResults[s.adiposeField] ?? 0);
    if (!muscle && !adipose) return null;
    return { muscle, adipose };
  };

  const hasAnyData = SEGMENTS.some(s => getSectionData(s) !== null);

  const bodyImage = sex === 'male' ? '/body_male.png' : '/body_female.png';

  const IMG_W = 340;
  const IMG_H = 520;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Perfil Corporal 2D — Secciones Transversales</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Vista anterior · Kerr ISAK · Superficie muscular y adiposa por segmento
          {' '}·{' '}
          <span className="font-medium text-gray-500">{sex === 'male' ? 'Masculino' : 'Femenino'}</span>
        </p>
      </div>

      <div className="flex items-start justify-center py-6 px-4 overflow-x-auto">
        <svg
          viewBox={`-160 -10 ${IMG_W + 320} ${IMG_H + 20}`}
          className="w-full"
          style={{ maxWidth: 680, minWidth: 420, height: 'auto' }}
        >
          <image
            href={bodyImage}
            x="0"
            y="0"
            width={IMG_W}
            height={IMG_H}
            preserveAspectRatio="xMidYMid meet"
            style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))' }}
          />

          {SEGMENTS.map((seg) => {
            const data = getSectionData(seg);
            const isHov = hoveredId === seg.id;
            const lineColor = isHov ? '#1d4ed8' : '#475569';
            const dotColor = isHov ? '#1d4ed8' : '#64748b';

            const anchorX = (seg.anchorXpct / 100) * IMG_W;
            const anchorY = (seg.anchorYpct / 100) * IMG_H;

            const labelX = seg.side === 'left' ? -8 : IMG_W + 8;
            const midX = seg.side === 'left'
              ? anchorX - (anchorX - labelX) * 0.4
              : anchorX + (labelX - anchorX) * 0.4;

            return (
              <g
                key={seg.id}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredId(seg.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <circle cx={anchorX} cy={anchorY} r={isHov ? 6 : 5}
                  fill={dotColor} stroke="white" strokeWidth="1.5" opacity="0.9" />
                <circle cx={anchorX} cy={anchorY} r={2} fill="white" />

                <path
                  d={`M ${anchorX} ${anchorY} L ${midX} ${anchorY} L ${labelX} ${anchorY}`}
                  stroke={lineColor}
                  strokeWidth={isHov ? 1.5 : 1}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={isHov ? 1 : 0.7}
                  strokeDasharray={isHov ? 'none' : '4 2'}
                />

                {seg.side === 'left' ? (
                  <g>
                    <text x={labelX - 4} y={anchorY - 7}
                      textAnchor="end" fontSize="9" fontWeight={isHov ? '700' : '500'}
                      fill={isHov ? '#1d4ed8' : '#1e293b'} fontFamily="system-ui,sans-serif">
                      {seg.labelMuscle}
                    </text>
                    {data ? (
                      <text x={labelX - 4} y={anchorY + 3}
                        textAnchor="end" fontSize="8.5"
                        fill={isHov ? '#dc2626' : '#475569'} fontFamily="system-ui,sans-serif" fontWeight="600">
                        {data.muscle.toFixed(1)} cm²
                      </text>
                    ) : (
                      <text x={labelX - 4} y={anchorY + 3}
                        textAnchor="end" fontSize="8"
                        fill="#94a3b8" fontFamily="system-ui,sans-serif">
                        — cm²
                      </text>
                    )}
                    <text x={labelX - 4} y={anchorY + 14}
                      textAnchor="end" fontSize="9" fontWeight={isHov ? '700' : '400'}
                      fill={isHov ? '#1d4ed8' : '#64748b'} fontFamily="system-ui,sans-serif">
                      {seg.labelAdipose}
                    </text>
                    {data ? (
                      <text x={labelX - 4} y={anchorY + 24}
                        textAnchor="end" fontSize="8.5"
                        fill={isHov ? '#f97316' : '#94a3b8'} fontFamily="system-ui,sans-serif" fontWeight="600">
                        {data.adipose.toFixed(1)} cm²
                        {' '}
                        ({((data.adipose / (data.muscle + data.adipose)) * 100).toFixed(0)}% adip.)
                      </text>
                    ) : (
                      <text x={labelX - 4} y={anchorY + 24}
                        textAnchor="end" fontSize="8"
                        fill="#94a3b8" fontFamily="system-ui,sans-serif">
                        — cm²
                      </text>
                    )}
                  </g>
                ) : (
                  <g>
                    <text x={labelX + 4} y={anchorY - 7}
                      textAnchor="start" fontSize="9" fontWeight={isHov ? '700' : '500'}
                      fill={isHov ? '#1d4ed8' : '#1e293b'} fontFamily="system-ui,sans-serif">
                      {seg.labelMuscle}
                    </text>
                    {data ? (
                      <text x={labelX + 4} y={anchorY + 3}
                        textAnchor="start" fontSize="8.5"
                        fill={isHov ? '#dc2626' : '#475569'} fontFamily="system-ui,sans-serif" fontWeight="600">
                        {data.muscle.toFixed(1)} cm²
                      </text>
                    ) : (
                      <text x={labelX + 4} y={anchorY + 3}
                        textAnchor="start" fontSize="8"
                        fill="#94a3b8" fontFamily="system-ui,sans-serif">
                        — cm²
                      </text>
                    )}
                    <text x={labelX + 4} y={anchorY + 14}
                      textAnchor="start" fontSize="9" fontWeight={isHov ? '700' : '400'}
                      fill={isHov ? '#1d4ed8' : '#64748b'} fontFamily="system-ui,sans-serif">
                      {seg.labelAdipose}
                    </text>
                    {data ? (
                      <text x={labelX + 4} y={anchorY + 24}
                        textAnchor="start" fontSize="8.5"
                        fill={isHov ? '#f97316' : '#94a3b8'} fontFamily="system-ui,sans-serif" fontWeight="600">
                        {data.adipose.toFixed(1)} cm²
                        {' '}
                        ({((data.adipose / (data.muscle + data.adipose)) * 100).toFixed(0)}% adip.)
                      </text>
                    ) : (
                      <text x={labelX + 4} y={anchorY + 24}
                        textAnchor="start" fontSize="8"
                        fill="#94a3b8" fontFamily="system-ui,sans-serif">
                        — cm²
                      </text>
                    )}
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-600" />
          <span className="text-xs text-gray-500 dark:text-gray-400">Sup. muscular (cm²)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-orange-400" />
          <span className="text-xs text-gray-500 dark:text-gray-400">Sup. adiposa (cm²)</span>
        </div>
        {!hasAnyData && (
          <span className="text-xs text-gray-400 ml-auto italic">Sin resultados Kerr — calculá primero para ver los valores</span>
        )}
      </div>
    </div>
  );
}
