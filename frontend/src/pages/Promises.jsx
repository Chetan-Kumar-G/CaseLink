import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { CalendarClock, FileWarning, HandCoins, MessageCircleQuestion } from 'lucide-react';
import { api, errorMessage } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { PromiseRow, RateRing } from '../components/promises.jsx';
import { Card, EmptyState, ErrorState, Page, PageHeader, Skeleton, StatTile, stagger } from '../components/ui.jsx';

const TABS = [
  { key: 'open', label: 'Open' },
  { key: 'due_soon', label: 'Due in 7 days' },
  { key: 'awaiting', label: 'Asking complainant' },
  { key: 'broken', label: 'Broken' },
  { key: 'kept', label: 'Kept' },
  { key: 'all', label: 'All' },
];

export default function Promises() {
  const { user } = useAuth();
  const [filter, setFilter] = useState('open');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    api
      .get('/promises', { params: { filter } })
      .then((r) => setData(r.data))
      .catch((e) => setError(errorMessage(e)));
  }, [filter]);
  useEffect(load, [load]);

  // Institutions ranked by Promise Kept Rate (only those with a decided outcome).
  const [names, setNames] = useState({});
  useEffect(() => {
    api.get('/institutions').then((r) => setNames(Object.fromEntries(r.data.institutions.map((i) => [i.id, i])))).catch(() => {});
  }, []);
  const ranked = (data?.institutions || [])
    .filter((i) => i.rate != null && names[i.id])
    .sort((a, b) => a.rate - b.rate);

  return (
    <Page>
      <PageHeader
        eyebrow="Promise Ledger"
        title="Every promise is a tracked debt"
        description="When an institution answers with a promise, CaseLink records it. On the deadline the complainant is asked whether it was kept — a “No” reopens the case."
      />

      {error && <ErrorState message={error} onRetry={load} />}
      {!data && !error && <Skeleton className="h-64" />}

      {data && (
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" data-tour="ledger-stats">
            <StatTile icon={HandCoins} label="Open promises" value={data.stats.open} hint="Waiting for their deadline" />
            <StatTile icon={CalendarClock} label="Due in 7 days" value={data.stats.dueSoon} hint="Check-ins going out soon" tone="honey" />
            <StatTile icon={MessageCircleQuestion} label="Asking complainant" value={data.stats.awaiting} hint="Deadline reached, awaiting answer" tone="teal" pulse />
            <StatTile icon={FileWarning} label="Broken" value={data.stats.broken} hint="Reopened after a “No”" tone="rosewood" />
          </div>

          <div className="grid gap-4 xl:grid-cols-3 [&>*]:min-w-0">
            <Card className="p-5" data-tour="ledger-rate">
              <h2 className="font-bold text-ink">Promise Kept Rate</h2>
              <p className="text-xs text-ink-muted">Kept = 1, partly kept = ½, broken = 0 — confirmed outcomes only</p>
              <div className="mt-4 flex items-center gap-5">
                <RateRing rate={data.stats.rate} size={112} stroke={11} />
                <ul className="space-y-1.5 text-sm">
                  <li className="text-ink-soft">
                    <b className="text-ink">{data.stats.kept}</b> kept
                  </li>
                  <li className="text-ink-soft">
                    <b className="text-ink">{data.stats.partly}</b> partly kept
                  </li>
                  <li className="text-ink-soft">
                    <b className="text-ink">{data.stats.broken}</b> broken
                  </li>
                  <li className="text-ink-muted">{data.stats.unconfirmed} with no answer (not scored)</li>
                </ul>
              </div>
              <h3 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wide text-ink-muted">By institution, lowest first</h3>
              <ul className="space-y-2" data-tour="ledger-institutions">
                {ranked.map((r, i) => (
                  <li key={r.id}>
                    <Link to={`/institutions/${names[r.id].permanentId}`} className="group block">
                      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                        <span className="truncate text-ink-soft group-hover:text-ember-800">{names[r.id].name}</span>
                        <span className="shrink-0 font-bold text-ink">
                          {r.rate}% <span className="text-xs font-normal text-ink-muted">of {r.decided}</span>
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-paper-deep/70">
                        <motion.div className="h-full rounded-full bg-ember-500" initial={{ width: 0 }} animate={{ width: `${Math.max(2, r.rate)}%` }} transition={{ delay: 0.1 + i * 0.06, duration: 0.7 }} />
                      </div>
                    </Link>
                  </li>
                ))}
                {!ranked.length && <li className="text-sm text-ink-muted">No confirmed outcomes yet.</li>}
              </ul>
              {user.bureau === 'AB' && <p className="mt-4 rounded-xl bg-plum-50 px-3 py-2 text-xs text-plum-700">Approval Bureau: this record is shown next to the grievance history at approval renewal.</p>}
            </Card>

            <div className="space-y-3 xl:col-span-2">
              <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-2xl bg-paper-deep/60 p-1" role="tablist" data-tour="ledger-tabs">
                {TABS.map((t) => (
                  <button key={t.key} role="tab" aria-selected={filter === t.key} onClick={() => setFilter(t.key)} className="relative shrink-0 rounded-xl px-3.5 py-2 text-sm font-semibold">
                    {filter === t.key && <motion.span layoutId="ledger-tab" className="absolute inset-0 rounded-xl bg-white shadow-card" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
                    <span className={clsx('relative', filter === t.key ? 'text-ink' : 'text-ink-muted')}>{t.label}</span>
                  </button>
                ))}
              </div>
              {data.entries.length === 0 ? (
                <EmptyState icon={HandCoins} title="Nothing here">No promises match this view.</EmptyState>
              ) : (
                <ul className="space-y-3" data-tour="ledger-list">
                  {data.entries.map((e) => (
                    <PromiseRow key={e.id} entry={e} demo={data.demoControls} onChanged={load} />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </Page>
  );
}
