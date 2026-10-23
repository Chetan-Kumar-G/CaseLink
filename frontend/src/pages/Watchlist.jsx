import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, Info, Radar, TrendingUp } from 'lucide-react';
import { api, errorMessage } from '../lib/api.js';
import { formatDate } from '../lib/format.js';
import { BureauBadge } from '../components/badges.jsx';
import { EmptyState, ErrorState, Page, PageHeader, Skeleton, fadeUp, stagger } from '../components/ui.jsx';

function Compare({ recent, expected, windowDays }) {
  const max = Math.max(recent, expected, 1);
  const rows = [
    { label: `Last ${windowDays} days`, value: recent, cls: 'bg-ember-500', text: String(recent) },
    { label: 'Usual for this period', value: expected, cls: 'bg-ink-faint', text: expected < 1 ? '< 1' : expected.toFixed(1) },
  ];
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={r.label}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-ink-muted">{r.label}</span>
            <span className="font-bold tabular-nums text-ink">{r.text}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-paper-deep/70">
            <motion.div className={`h-full rounded-full ${r.cls}`} initial={{ width: 0 }} animate={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} transition={{ delay: 0.2 + i * 0.1, duration: 0.8 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Watchlist() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    api.get('/watchlist').then((r) => setData(r.data)).catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(load, [load]);

  const cfg = data?.config;
  return (
    <Page>
      <PageHeader eyebrow="Early warning" title="Institution Watchlist" description="Institutions whose complaint volume in one category is well above their own usual level." />

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex gap-3 rounded-2xl border border-honey-100 bg-honey-50/70 p-4 text-sm text-ink-soft" data-tour="wl-note">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-honey-700" />
        <p>
          <b className="text-ink">A trend, not a finding.</b> The Watchlist shows that complaint volume has changed. It says nothing about guilt or wrongdoing and produces no risk score — volume can also rise because more students learn about the grievance channel. Use it to decide where to look, then review the cases.
          {cfg && (
            <span className="mt-1 block text-xs text-ink-muted">
              Rule: at least {cfg.minCount} complaints in {cfg.windowDays} days and at least {cfg.minRatio}× the rate seen over the previous {cfg.baselineDays} days.
            </span>
          )}
        </p>
      </motion.div>

      {error && <ErrorState message={error} onRetry={load} />}
      {!data && !error && (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      )}
      {data?.items.length === 0 && <EmptyState icon={Radar} title="No unusual trends right now">Every institution is within its usual complaint volume.</EmptyState>}

      {data?.items.length > 0 && (
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-4 md:grid-cols-2" data-tour="wl-grid">
          {data.items.map((w) => (
            <motion.article key={`${w.institution.id}-${w.category}`} variants={fadeUp} className="card flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-ember-600">{w.categoryLabel}</p>
                  <Link to={`/institutions/${w.institution.permanentId}`} className="mt-1 block font-bold leading-snug text-ink hover:text-ember-800">
                    {w.institution.name}
                  </Link>
                  <p className="font-mono text-xs text-ink-muted">
                    {w.institution.permanentId} · {w.institution.city}
                  </p>
                </div>
                <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.2 }} className="flex shrink-0 items-center gap-1 rounded-full bg-ember-500 px-3 py-1 text-sm font-extrabold text-white">
                  <TrendingUp className="h-4 w-4" /> {w.ratio}×
                </motion.span>
              </div>
              <p className="mt-3 text-sm text-ink-soft">{w.signal}.</p>
              <div className="mt-4">
                <Compare recent={w.recent} expected={w.expected} windowDays={cfg.windowDays} />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
                {w.bureaus.map((b) => (
                  <BureauBadge key={b} code={b} />
                ))}
                <span>
                  · {w.open} still open · {formatDate(w.firstRecent)} – {formatDate(w.lastRecent)}
                </span>
              </div>
              <Link to={`/institutions/${w.institution.permanentId}`} className="link mt-4 inline-flex items-center gap-1 self-start text-sm">
                Review in Institution 360 <ArrowUpRight className="h-4 w-4" />
              </Link>
            </motion.article>
          ))}
        </motion.div>
      )}
    </Page>
  );
}
