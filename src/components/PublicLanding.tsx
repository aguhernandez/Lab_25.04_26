import { useState, useEffect, useRef } from 'react';

interface Props {
  onLogin: () => void;
}

function AnimatedCounter({ target, suffix = '', duration = 2000 }: { target: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = Date.now();
          const tick = () => {
            const elapsed = Date.now() - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);

  return <span ref={ref}>{count}{suffix}</span>;
}

const METRIC_CARDS = [
  {
    label: 'Countermovement Jump',
    abbr: 'CMJ',
    value: '48.3',
    unit: 'cm',
    delta: '+2.1',
    positive: true,
    color: 'from-blue-500/20 to-blue-600/5',
    accent: '#3b82f6',
    bars: [62, 71, 68, 74, 70, 78, 75, 82, 79, 85, 83, 88],
  },
  {
    label: 'Reactive Strength Index',
    abbr: 'RSI',
    value: '2.84',
    unit: '',
    delta: '+0.18',
    positive: true,
    color: 'from-emerald-500/20 to-emerald-600/5',
    accent: '#10b981',
    bars: [55, 60, 58, 65, 62, 68, 70, 72, 69, 75, 73, 78],
  },
  {
    label: 'Peak Bar Velocity',
    abbr: 'VBT',
    value: '1.24',
    unit: 'm/s',
    delta: '+0.07',
    positive: true,
    color: 'from-amber-500/20 to-amber-600/5',
    accent: '#f59e0b',
    bars: [45, 52, 48, 58, 55, 62, 60, 65, 63, 68, 66, 72],
  },
  {
    label: 'Asymmetry Index',
    abbr: 'ASY',
    value: '3.2',
    unit: '%',
    delta: '-1.4',
    positive: true,
    color: 'from-rose-500/20 to-rose-600/5',
    accent: '#f43f5e',
    bars: [80, 72, 75, 68, 65, 60, 62, 57, 55, 52, 50, 48],
  },
  {
    label: 'Sprint Acceleration',
    abbr: '10m',
    value: '1.73',
    unit: 's',
    delta: '-0.04',
    positive: true,
    color: 'from-cyan-500/20 to-cyan-600/5',
    accent: '#06b6d4',
    bars: [88, 82, 85, 78, 75, 72, 70, 68, 65, 63, 61, 59],
  },
  {
    label: 'Readiness Score',
    abbr: 'HRV',
    value: '87',
    unit: '',
    delta: '+5',
    positive: true,
    color: 'from-violet-500/20 to-violet-600/5',
    accent: '#8b5cf6',
    bars: [50, 55, 52, 60, 58, 65, 63, 70, 68, 74, 72, 78],
  },
];

const MODULES = [
  {
    title: 'Jump Testing',
    desc: 'CMJ, SJ, drop jump, RSI — full plyometric diagnostic battery with force-time curve analysis.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    tag: 'Biomechanics',
  },
  {
    title: 'Velocity Based Training',
    desc: 'Real-time bar velocity profiling, load-velocity relationships, and optimal training zones.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    tag: 'Strength',
  },
  {
    title: 'Sprint Analysis',
    desc: 'Acceleration, top speed, and mechanical sprint profiling from split times to force-velocity outputs.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    tag: 'Speed',
  },
  {
    title: 'Readiness Monitoring',
    desc: 'HRV-based daily readiness scoring, fatigue indices, and recovery state visualization.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
    tag: 'Recovery',
  },
  {
    title: 'Force Production',
    desc: 'Peak force, rate of force development, and bilateral asymmetry from isometric and dynamic tests.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    tag: 'Power',
  },
  {
    title: 'Athlete Profiling',
    desc: 'Comprehensive physiological and anthropometric profiling with longitudinal trend analysis.',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    tag: 'Diagnostics',
  },
];

const ECOSYSTEM = [
  {
    name: 'Academy',
    desc: 'Training methodology and periodization science.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    color: 'border-blue-500/30 hover:border-blue-500/60',
    dot: 'bg-blue-500',
  },
  {
    name: 'Endurance',
    desc: 'Metabolic testing, VO2 profiling, and training zones.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
    color: 'border-emerald-500/30 hover:border-emerald-500/60',
    dot: 'bg-emerald-500',
  },
  {
    name: 'Nutrition',
    desc: 'Body composition targets, hydration, and fueling protocols.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
    color: 'border-amber-500/30 hover:border-amber-500/60',
    dot: 'bg-amber-500',
  },
  {
    name: 'Hub',
    desc: 'Unified athlete management and coaching platform.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
    color: 'border-rose-500/30 hover:border-rose-500/60',
    dot: 'bg-rose-500',
  },
];

function MiniSparkline({ bars, accent }: { bars: number[]; accent: string }) {
  const max = Math.max(...bars);
  const min = Math.min(...bars);
  const range = max - min || 1;
  const h = 32;
  const w = 80;
  const step = w / (bars.length - 1);
  const pts = bars
    .map((v, i) => `${i * step},${h - ((v - min) / range) * h}`)
    .join(' ');

  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        points={pts}
        fill="none"
        stroke={accent}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
      {bars.map((v, i) => (
        i === bars.length - 1 ? (
          <circle
            key={i}
            cx={i * step}
            cy={h - ((v - min) / range) * h}
            r="2.5"
            fill={accent}
          />
        ) : null
      ))}
    </svg>
  );
}

export default function PublicLanding({ onLogin }: Props) {
  const [scrollY, setScrollY] = useState(0);
  const [activeModuleIdx, setActiveModuleIdx] = useState<number | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const heroOpacity = Math.max(0, 1 - scrollY / 500);
  const heroTranslate = scrollY * 0.3;

  return (
    <div className="min-h-screen bg-[#080c10] text-white overflow-x-hidden">

      {/* ─── NAV ─────────────────────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: scrollY > 60
            ? 'rgba(8,12,16,0.92)'
            : 'transparent',
          backdropFilter: scrollY > 60 ? 'blur(12px)' : 'none',
          borderBottom: scrollY > 60 ? '1px solid rgba(255,255,255,0.06)' : 'none',
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="Asciende" className="w-8 h-8" />
            <span className="text-sm font-semibold tracking-widest text-white/80 uppercase">Asciende LAB</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            {['Testing Modules', 'Diagnostics', 'Ecosystem'].map(item => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(' ', '-')}`}
                className="text-sm text-white/50 hover:text-white transition-colors tracking-wide"
              >
                {item}
              </a>
            ))}
          </nav>
          <button
            onClick={onLogin}
            className="px-5 py-2 rounded-lg bg-white text-[#080c10] text-sm font-semibold hover:bg-white/90 transition-all"
          >
            Sign In
          </button>
        </div>
      </header>

      {/* ─── HERO ────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">

        {/* Grid background */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />

        {/* Radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(59,130,246,0.08) 0%, transparent 70%)',
          }}
        />

        {/* Corner accents */}
        <div className="absolute top-1/4 left-1/4 w-px h-48 bg-gradient-to-b from-transparent via-blue-500/20 to-transparent" />
        <div className="absolute top-1/3 right-1/4 w-px h-32 bg-gradient-to-b from-transparent via-emerald-500/20 to-transparent" />
        <div className="absolute top-2/3 left-1/3 w-48 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Floating metric badges */}
        <div
          className="absolute left-8 top-1/3 hidden xl:flex flex-col gap-3"
          style={{ opacity: heroOpacity, transform: `translateY(${heroTranslate * 0.5}px)` }}
        >
          {[
            { label: 'VO2max', value: '68.4', unit: 'ml/kg/min', color: '#3b82f6' },
            { label: 'FTP', value: '342', unit: 'W', color: '#10b981' },
            { label: 'W\'', value: '18.4', unit: 'kJ', color: '#f59e0b' },
          ].map(m => (
            <div
              key={m.label}
              className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 backdrop-blur-sm"
            >
              <div className="text-[10px] text-white/40 uppercase tracking-widest mb-1">{m.label}</div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold" style={{ color: m.color }}>{m.value}</span>
                <span className="text-xs text-white/30">{m.unit}</span>
              </div>
            </div>
          ))}
        </div>

        <div
          className="absolute right-8 top-1/3 hidden xl:flex flex-col gap-3"
          style={{ opacity: heroOpacity, transform: `translateY(${heroTranslate * 0.5}px)` }}
        >
          {[
            { label: 'Peak Power', value: '1,247', unit: 'W', color: '#f43f5e' },
            { label: 'RSI', value: '2.84', unit: '', color: '#8b5cf6' },
            { label: 'HRV Score', value: '87', unit: '/100', color: '#06b6d4' },
          ].map(m => (
            <div
              key={m.label}
              className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 backdrop-blur-sm"
            >
              <div className="text-[10px] text-white/40 uppercase tracking-widest mb-1">{m.label}</div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold" style={{ color: m.color }}>{m.value}</span>
                <span className="text-xs text-white/30">{m.unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Hero content */}
        <div
          className="relative z-10 text-center px-6 max-w-4xl mx-auto"
          style={{ opacity: heroOpacity, transform: `translateY(${-heroTranslate * 0.2}px)` }}
        >
          <div className="inline-flex items-center gap-2 border border-white/10 rounded-full px-4 py-1.5 mb-8 bg-white/[0.03] backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-white/50 tracking-widest uppercase">Human Performance Intelligence</span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight mb-6">
            <span className="block text-white">Measure.</span>
            <span className="block bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
              Diagnose.
            </span>
            <span className="block text-white/70">Elevate.</span>
          </h1>

          <p className="text-lg text-white/40 max-w-2xl mx-auto leading-relaxed mb-10">
            A precision sports science platform built for coaches and scientists who demand
            more than averages. From force curves to physiological profiles — every data
            point, contextualized.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={onLogin}
              className="group px-8 py-4 rounded-xl bg-white text-[#080c10] font-semibold text-sm tracking-wide hover:bg-white/90 transition-all flex items-center justify-center gap-2"
            >
              Access the Lab
              <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
            <a
              href="#testing-modules"
              className="px-8 py-4 rounded-xl border border-white/10 text-white/60 font-medium text-sm tracking-wide hover:border-white/20 hover:text-white/80 transition-all text-center"
            >
              Explore Modules
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-30">
          <span className="text-xs tracking-widest uppercase text-white/50">Scroll</span>
          <div className="w-px h-12 bg-gradient-to-b from-white/40 to-transparent" />
        </div>
      </section>

      {/* ─── METRICS PREVIEW ─────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-12 flex-wrap gap-4">
            <div>
              <p className="text-xs text-white/30 uppercase tracking-widest mb-2">Live diagnostics</p>
              <h2 className="text-3xl font-bold text-white">Performance Metrics</h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-white/30">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Monitoring active
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {METRIC_CARDS.map((card) => (
              <div
                key={card.abbr}
                className={`relative rounded-2xl border border-white/[0.06] bg-gradient-to-br ${card.color} p-5 overflow-hidden group hover:border-white/[0.12] transition-all duration-300 cursor-default`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="text-[10px] text-white/30 uppercase tracking-widest mb-1">{card.label}</div>
                      <div className="text-xs font-mono text-white/20 tracking-widest">{card.abbr}</div>
                    </div>
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        color: card.positive ? '#10b981' : '#f43f5e',
                        background: card.positive ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)',
                      }}
                    >
                      {card.delta}
                    </span>
                  </div>

                  <div className="flex items-end justify-between">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-bold text-white">{card.value}</span>
                      {card.unit && (
                        <span className="text-sm text-white/30 mb-0.5">{card.unit}</span>
                      )}
                    </div>
                    <MiniSparkline bars={card.bars} accent={card.accent} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TESTING MODULES ─────────────────────────────────── */}
      <section id="testing-modules" className="py-24 px-6 border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12">
            <p className="text-xs text-white/30 uppercase tracking-widest mb-2">Diagnostic Suite</p>
            <h2 className="text-3xl font-bold text-white mb-3">Testing Modules</h2>
            <p className="text-white/40 max-w-xl">
              Each module is a complete diagnostic system. Not just data collection — science-driven interpretation.
            </p>
          </div>

          <div
            ref={carouselRef}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {MODULES.map((mod, i) => (
              <div
                key={mod.title}
                onMouseEnter={() => setActiveModuleIdx(i)}
                onMouseLeave={() => setActiveModuleIdx(null)}
                className={`group relative rounded-2xl border p-6 cursor-default transition-all duration-300 overflow-hidden ${
                  activeModuleIdx === i
                    ? 'border-white/20 bg-white/[0.05]'
                    : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
                }`}
              >
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    background: 'radial-gradient(circle at var(--x, 50%) var(--y, 50%), rgba(59,130,246,0.06) 0%, transparent 60%)',
                  }}
                />

                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-5">
                    <div className="p-2.5 rounded-xl bg-white/[0.06] text-white/60 group-hover:text-white transition-colors">
                      {mod.icon}
                    </div>
                    <span className="text-[10px] uppercase tracking-widest text-white/25 border border-white/10 rounded-full px-2.5 py-1">
                      {mod.tag}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-white mb-2">{mod.title}</h3>
                  <p className="text-sm text-white/40 leading-relaxed">{mod.desc}</p>

                  <div className="mt-5 flex items-center gap-2 text-xs text-white/25 group-hover:text-white/50 transition-colors">
                    <span>Requires login</span>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── WORKFLOW PREVIEW ────────────────────────────────── */}
      <section id="diagnostics" className="py-24 px-6 border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-xs text-white/30 uppercase tracking-widest mb-2">Workflow</p>
              <h2 className="text-3xl font-bold text-white mb-5">
                Science-Driven
                <br />
                <span className="text-white/40">Performance Reporting</span>
              </h2>
              <p className="text-white/40 leading-relaxed mb-8">
                Every assessment follows a structured protocol — pre-test readiness, live data
                acquisition, automated interpretation, and a longitudinal record that builds with
                every session.
              </p>

              <div className="space-y-4">
                {[
                  { step: '01', label: 'Athlete Selection', desc: 'Load profile with physiological history' },
                  { step: '02', label: 'Protocol Setup', desc: 'Configure test parameters and conditions' },
                  { step: '03', label: 'Live Acquisition', desc: 'Real-time data capture and quality control' },
                  { step: '04', label: 'Automated Analysis', desc: 'Immediate science-based interpretation' },
                  { step: '05', label: 'Report Generation', desc: 'Export professional diagnostics PDF' },
                ].map(({ step, label, desc }) => (
                  <div key={step} className="flex items-start gap-4 group">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:border-white/20 transition-colors">
                      <span className="text-[10px] font-mono text-white/30">{step}</span>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white/80 mb-0.5">{label}</div>
                      <div className="text-xs text-white/30">{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mock dashboard panel */}
            <div className="relative">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <div className="text-xs text-white/30 mb-1">Athlete Profile</div>
                    <div className="text-sm font-semibold text-white">Session Report — Sprint Battery</div>
                  </div>
                  <div className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">Complete</div>
                </div>

                {/* Mock chart bars */}
                <div className="mb-6">
                  <div className="text-xs text-white/20 mb-3">Force-Velocity Profile</div>
                  <div className="flex items-end gap-1.5 h-24">
                    {[55, 72, 88, 95, 91, 84, 76, 68, 60, 52, 45, 38].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t-sm transition-all"
                        style={{
                          height: `${h}%`,
                          background: i < 5
                            ? `rgba(59,130,246,${0.3 + i * 0.1})`
                            : `rgba(59,130,246,${0.6 - (i - 5) * 0.05})`,
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[9px] text-white/20">Low Load</span>
                    <span className="text-[9px] text-white/20">High Load</span>
                  </div>
                </div>

                {/* Mock stats row */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'F0', value: '1,847', unit: 'N' },
                    { label: 'V0', value: '9.43', unit: 'm/s' },
                    { label: 'Pmax', value: '4,356', unit: 'W' },
                  ].map(s => (
                    <div key={s.label} className="bg-white/[0.03] rounded-xl p-3 text-center">
                      <div className="text-[10px] text-white/25 uppercase tracking-widest mb-1">{s.label}</div>
                      <div className="text-lg font-bold text-white">{s.value}</div>
                      <div className="text-[10px] text-white/25">{s.unit}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Floating badge */}
              <div className="absolute -top-4 -right-4 bg-[#080c10] border border-white/10 rounded-xl px-4 py-3 shadow-xl">
                <div className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Monitoring</div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-sm font-semibold text-white">
                    <AnimatedCounter target={247} /> Athletes
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── STATS STRIP ─────────────────────────────────────── */}
      <section className="py-16 px-6 border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: 12, suffix: '+', label: 'Testing Protocols' },
              { value: 50, suffix: '+', label: 'Diagnostic Metrics' },
              { value: 98, suffix: '%', label: 'Data Accuracy' },
              { value: 3, suffix: 'x', label: 'Faster Reporting' },
            ].map(stat => (
              <div key={stat.label} className="text-center">
                <div className="text-4xl font-bold text-white mb-1">
                  <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                </div>
                <div className="text-sm text-white/30">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── ECOSYSTEM ───────────────────────────────────────── */}
      <section id="ecosystem" className="py-24 px-6 border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs text-white/30 uppercase tracking-widest mb-2">Connected Platform</p>
            <h2 className="text-3xl font-bold text-white mb-3">The Asciende Ecosystem</h2>
            <p className="text-white/40 max-w-xl mx-auto">
              Lab is one node in a connected performance intelligence network.
              Data flows between platforms, eliminating silos.
            </p>
          </div>

          {/* Center hub */}
          <div className="relative flex flex-col items-center">
            <div className="relative z-10 bg-[#080c10] border border-white/15 rounded-2xl px-8 py-5 mb-10 shadow-xl shadow-black/50">
              <div className="flex items-center gap-3">
                <img src="/favicon.svg" alt="LAB" className="w-8 h-8" />
                <div>
                  <div className="text-[10px] text-white/30 uppercase tracking-widest">Core</div>
                  <div className="text-sm font-bold text-white">Asciende LAB</div>
                </div>
                <span className="ml-2 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-3xl">
              {ECOSYSTEM.map(item => (
                <div
                  key={item.name}
                  className={`rounded-2xl border ${item.color} bg-white/[0.02] p-5 text-center group transition-all duration-300`}
                >
                  <div className="flex justify-center mb-3 text-white/40 group-hover:text-white/60 transition-colors">
                    {item.icon}
                  </div>
                  <div className="flex items-center justify-center gap-1.5 mb-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${item.dot}`} />
                    <span className="text-sm font-semibold text-white/80">{item.name}</span>
                  </div>
                  <p className="text-xs text-white/30 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ───────────────────────────────────────── */}
      <section className="py-32 px-6 border-t border-white/[0.04] relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 60% 50% at 50% 100%, rgba(59,130,246,0.06) 0%, transparent 70%)',
          }}
        />
        <div className="max-w-2xl mx-auto text-center relative z-10">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-5 leading-tight">
            Ready to go beyond
            <br />
            <span className="text-white/40">the spreadsheet?</span>
          </h2>
          <p className="text-white/40 mb-10 leading-relaxed">
            Access the full diagnostic suite. Build athlete profiles. Generate professional
            performance reports. All in one integrated platform.
          </p>
          <button
            onClick={onLogin}
            className="group inline-flex items-center gap-3 px-10 py-4 rounded-xl bg-white text-[#080c10] font-semibold text-base hover:bg-white/90 transition-all"
          >
            Enter the Lab
            <svg className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </button>
        </div>
      </section>

      {/* ─── FOOTER ──────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.04] py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" alt="Asciende" className="w-5 h-5 opacity-40" />
            <span className="text-xs text-white/20 tracking-widest uppercase">Asciende LAB</span>
          </div>
          <p className="text-xs text-white/15">Human Performance Intelligence Platform</p>
        </div>
      </footer>
    </div>
  );
}
