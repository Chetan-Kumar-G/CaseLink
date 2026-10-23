import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { BarChart3, Table2 } from 'lucide-react';

// Chart colours (validated with the dataviz palette checker):
//   bureaus  — categorical, PGRC/RB/AB
//   pipeline — ordinal ember ramp, light→dark through the case workflow,
//              keyed by stage so a stage keeps its colour whatever is shown
export const BUREAU_HEX = { PGRC: '#00939E', RB: '#DB540E', AB: '#7A5A9A' };
export const PIPELINE_HEX = {
  registered: '#F29A5C',
  under_review: '#E47A36',
  awaiting_institution: '#D26020',
  coordination: '#B84D14',
  resolved_on_promise: '#963E11',
  resolved: '#73300F',
  closed: '#4F230D',
};
export const INK = { text: '#231B16', soft: '#4A3F38', muted: '#7A6D64', faint: '#A99B91', grid: '#F0E2D2' };

/** Width of a container, kept current with ResizeObserver. */
export function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return undefined;
    setWidth(ref.current.getBoundingClientRect().width);
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

export function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduce(mq.matches);
    const on = (e) => setReduce(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduce;
}

/** Chart / table switch shown in a card header; every chart has a table twin. */
export function ViewToggle({ view, setView, label }) {
  return (
    <div className="flex rounded-lg bg-paper-deep/70 p-0.5" role="tablist" aria-label={`${label} view`}>
      {[
        ['chart', BarChart3, 'Chart'],
        ['table', Table2, 'Table'],
      ].map(([key, Icon, text]) => (
        <button
          key={key}
          role="tab"
          aria-selected={view === key}
          onClick={() => setView(key)}
          className={clsx('flex items-center gap-1 rounded-md px-2 py-1 text-[0.7rem] font-semibold transition', view === key ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink')}
        >
          <Icon className="h-3.5 w-3.5" /> {text}
        </button>
      ))}
    </div>
  );
}

/** Floating tooltip positioned inside a relative container. Values lead, labels follow. */
export function Tip({ x, y, width, children }) {
  if (x == null) return null;
  const left = Math.min(Math.max(8, x + 14), Math.max(8, width - 200));
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.12 }}
      className="pointer-events-none absolute z-10 min-w-[9rem] rounded-xl bg-ink px-3 py-2 text-xs text-white shadow-lift"
      style={{ left, top: Math.max(0, y - 12) }}
    >
      {children}
    </motion.div>
  );
}

export function DataTable({ columns, rows }) {
  return (
    <div className="scroll-x">
      <table className="w-full min-w-[320px] text-left text-sm">
        <thead className="border-b border-paper-line text-xs uppercase tracking-wide text-ink-muted">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={clsx('px-2 py-2 font-semibold', c.num && 'text-right')}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-paper-line">
          {rows.map((r, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.key} className={clsx('px-2 py-2 text-ink-soft', c.num && 'text-right tabular-nums text-ink')}>
                  {r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
