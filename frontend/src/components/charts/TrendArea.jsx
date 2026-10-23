import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { INK, Tip, useReducedMotion, useWidth } from './common.jsx';

const fmtWeek = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
const LINE = '#DB540E';

/** New complaints per week — one series, so no legend; the title names it. */
export default function TrendArea({ weekly }) {
  const [ref, width] = useWidth();
  const reduce = useReducedMotion();
  const [idx, setIdx] = useState(null);

  const plotH = 170;
  const axisH = 24;
  const padL = 30;
  const padR = 16;
  const padT = 16;

  const g = useMemo(() => {
    if (!width || !weekly.length) return null;
    const max = Math.max(4, ...weekly.map((w) => w.count));
    const yMax = Math.ceil(max / 2) * 2;
    const innerW = width - padL - padR;
    const x = (i) => padL + (weekly.length === 1 ? innerW / 2 : (i / (weekly.length - 1)) * innerW);
    const y = (v) => padT + (1 - v / yMax) * (plotH - padT);
    const pts = weekly.map((w, i) => [x(i), y(w.count)]);
    // Monotone-ish smoothing with short horizontal control handles.
    const line = pts.reduce((d, [px, py], i) => {
      if (i === 0) return `M${px},${py}`;
      const [qx, qy] = pts[i - 1];
      const dx = (px - qx) / 2.2;
      return `${d} C${qx + dx},${qy} ${px - dx},${py} ${px},${py}`;
    }, '');
    const area = `${line} L${pts.at(-1)[0]},${plotH} L${pts[0][0]},${plotH} Z`;
    const ticks = [0, yMax / 2, yMax];
    return { x, y, pts, line, area, ticks, yMax };
  }, [weekly, width]);

  const pick = (clientX) => {
    const r = ref.current.getBoundingClientRect();
    const rel = clientX - r.left;
    let best = 0;
    g.pts.forEach(([px], i) => {
      if (Math.abs(px - rel) < Math.abs(g.pts[best][0] - rel)) best = i;
    });
    setIdx(best);
  };

  const total = weekly.reduce((s, w) => s + w.count, 0);
  const last = weekly.at(-1);
  const prev = weekly.at(-2);

  return (
    <div ref={ref} className="relative" onMouseLeave={() => setIdx(null)}>
      {g && (
        <svg
          width={width}
          height={plotH + axisH}
          tabIndex={0}
          role="img"
          aria-label={`New complaints per week over the last ${weekly.length} weeks: ${total} in total, ${last.count} this week.`}
          className="outline-none focus-visible:ring-2 focus-visible:ring-ember-300"
          onMouseMove={(e) => pick(e.clientX)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') setIdx((i) => Math.min(weekly.length - 1, (i ?? -1) + 1));
            if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, (i ?? weekly.length) - 1));
          }}
          onBlur={() => setIdx(null)}
        >
          <defs>
            <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={LINE} stopOpacity="0.28" />
              <stop offset="1" stopColor={LINE} stopOpacity="0" />
            </linearGradient>
          </defs>
          {g.ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={width - padR} y1={g.y(t)} y2={g.y(t)} stroke={INK.grid} strokeWidth="1" />
              <text x={padL - 8} y={g.y(t) + 4} textAnchor="end" fontSize="10.5" fill={INK.muted} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {t}
              </text>
            </g>
          ))}
          {weekly.map((w, i) =>
            i % (width < 480 ? 3 : 2) === 0 || i === weekly.length - 1 ? (
              <text key={i} x={g.x(i)} y={plotH + 17} textAnchor="middle" fontSize="10.5" fill={INK.muted}>
                {fmtWeek.format(new Date(w.week))}
              </text>
            ) : null,
          )}
          <motion.path d={g.area} fill="url(#trend-fill)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduce ? 0 : 0.6, duration: 0.8 }} />
          <motion.path d={g.line} fill="none" stroke={LINE} strokeWidth="2" strokeLinecap="round" initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} />
          {/* Endpoint: selective direct label on the latest week. */}
          <motion.g initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: reduce ? 0 : 1.2, type: 'spring', stiffness: 300, damping: 14 }} style={{ transformOrigin: `${g.pts.at(-1)[0]}px ${g.pts.at(-1)[1]}px` }}>
            <circle cx={g.pts.at(-1)[0]} cy={g.pts.at(-1)[1]} r="5" fill={LINE} stroke="#fff" strokeWidth="2" />
          </motion.g>
          {idx != null && (
            <g pointerEvents="none">
              <line x1={g.pts[idx][0]} x2={g.pts[idx][0]} y1={padT - 6} y2={plotH} stroke={INK.faint} strokeWidth="1" />
              <circle cx={g.pts[idx][0]} cy={g.pts[idx][1]} r="5" fill={LINE} stroke="#fff" strokeWidth="2" />
            </g>
          )}
        </svg>
      )}
      {g && idx != null && (
        <Tip x={g.pts[idx][0]} y={g.pts[idx][1]} width={width}>
          <p className="text-base font-extrabold">{weekly[idx].count} new</p>
          <p className="flex items-center gap-1.5 text-white/75">
            <span className="inline-block h-0.5 w-3 rounded" style={{ background: LINE }} />
            Week of {fmtWeek.format(new Date(weekly[idx].week))}
          </p>
        </Tip>
      )}
      {last && (
        <p className="mt-1 text-xs text-ink-muted">
          <b className="text-ink">{last.count}</b> this week · {prev ? `${last.count - prev.count >= 0 ? '+' : ''}${last.count - prev.count} vs last week` : ''} · {total} in {weekly.length} weeks
        </p>
      )}
    </div>
  );
}
