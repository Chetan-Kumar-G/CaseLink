import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { AlarmClock, ArrowRight, FileStack, GitMerge, HandCoins, Plus } from 'lucide-react';
import { api, errorMessage } from '../lib/api.js';
import { AUDIT_LABEL, timeAgo } from '../lib/format.js';
import { useAuth, useMeta } from '../context/AuthContext.jsx';
import { BarList } from '../components/BarList.jsx';
import { BUREAU_STYLE } from '../components/badges.jsx';
import { Button, Card, ErrorState, Page, PageHeader, Skeleton, StatTile, stagger } from '../components/ui.jsx';
import FlowMap from '../components/charts/FlowMap.jsx';
import TrendArea from '../components/charts/TrendArea.jsx';
import Pipeline from '../components/charts/Pipeline.jsx';
import DeadlineRing from '../components/charts/DeadlineRing.jsx';
import { BUREAU_HEX, DataTable, ViewToggle } from '../components/charts/common.jsx';
import { RateRing, dueText, money } from '../components/promises.jsx';

const REFRESH_MS = 60_000;
const fmtWeek = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function CardHead({ title, subtitle, right }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-bold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

function LivePill({ updatedAt, refreshing, ai }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-ink-soft ring-1 ring-paper-line" title={ai?.reachable ? `AI matching online (${ai.mode})` : 'AI matching offline — exact and rule layers still run'}>
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sage-500 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-sage-500" />
      </span>
      {refreshing ? 'Refreshing…' : `Live · ${timeAgo(updatedAt)}`}
      <span className="text-ink-faint">·</span>
      <span className={ai?.reachable ? 'text-teal-700' : 'text-honey-700'}>AI {ai?.reachable ? 'on' : 'off'}</span>
    </span>
  );
}

const BREAKDOWN = [
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'bureau', label: 'By bureau' },
  { key: 'issue', label: 'By issue' },
];

export default function Dashboard() {
  const { user } = useAuth();
  const { bureauName, categoryLabel } = useMeta();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [flowView, setFlowView] = useState('chart');
  const [trendView, setTrendView] = useState('chart');
  const [breakdown, setBreakdown] = useState('pipeline');

  // Refetches keep the previous render (dimmed) instead of flashing skeletons.
  const load = useCallback(() => {
    setError('');
    setRefreshing(true);
    api
      .get('/dashboard/summary')
      .then((r) => {
        setData(r.data);
        setUpdatedAt(new Date());
      })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setRefreshing(false));
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const canCreate = ['officer', 'bureau_head', 'admin'].includes(user.role);
  const p = data?.promises;

  return (
    <Page>
      <PageHeader
        eyebrow="Overview"
        title={`${greeting}, ${user.name.split(' ')[0]}`}
        description="Every institution complaint across AICTE bureaus, in one place."
        actions={
          <>
            {updatedAt && <LivePill updatedAt={updatedAt} refreshing={refreshing && Boolean(data)} ai={data?.ai} />}
            {canCreate && (
              <Link to="/cases/new" data-tour="register">
                <Button icon={Plus}>Register case</Button>
              </Link>
            )}
          </>
        }
      />

      {error && !data && <ErrorState message={error} onRetry={load} />}
      {!data && !error && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-80" />
        </div>
      )}

      {data && (
        <motion.div variants={stagger} initial="hidden" animate="show" className={clsx('space-y-5 transition-opacity', refreshing && 'opacity-80')}>
          {/* Four numbers that matter */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" data-tour="stats">
            <StatTile icon={FileStack} label="Open cases" value={data.totals.open} hint={`${data.totals.cases} total · ${data.totals.institutions} institutions`} />
            <StatTile icon={GitMerge} label="Overlap alerts" value={data.totals.pendingOverlaps} hint={`${data.totals.crossBureauPending} span more than one bureau`} tone="teal" pulse />
            <StatTile icon={HandCoins} label="Open promises" value={p.open} hint={p.rate != null ? `${p.rate}% of promises kept so far` : 'No outcomes yet'} tone="plum" />
            <StatTile icon={AlarmClock} label="Overdue" value={data.totals.overdue} hint="Open past their deadline" tone="rosewood" />
          </div>

          {/* Connections + promises */}
          <div className="grid gap-4 xl:grid-cols-3 [&>*]:min-w-0">
            <Card className="overflow-hidden p-5 xl:col-span-2" data-tour="hotspots">
              <CardHead
                title="How open cases connect"
                subtitle="Bureau → institution. Wider ribbon, more open cases. Click an institution to open it."
                right={<ViewToggle view={flowView} setView={setFlowView} label="Flow" />}
              />
              {data.flows.length === 0 ? (
                <p className="py-10 text-center text-sm text-ink-muted">No open cases right now.</p>
              ) : flowView === 'chart' ? (
                <>
                  <FlowMap flows={data.flows} bureauName={bureauName} />
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                    {Object.entries(BUREAU_HEX).map(([code, hex]) => (
                      <span key={code} className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: hex }} /> {bureauName(code)}
                      </span>
                    ))}
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-ember-500" /> Cross-bureau overlap pending
                    </span>
                  </div>
                </>
              ) : (
                <DataTable
                  columns={[
                    { key: 'name', label: 'Institution' },
                    { key: 'PGRC', label: 'PGRC', num: true },
                    { key: 'RB', label: 'RB', num: true },
                    { key: 'AB', label: 'AB', num: true },
                    { key: 'total', label: 'Open', num: true },
                    { key: 'cross', label: 'Cross-bureau overlaps', num: true },
                  ]}
                  rows={data.flows.map((f) => ({
                    name: (
                      <Link className="link" to={`/institutions/${f.institution.permanentId}`}>
                        {f.institution.name}
                      </Link>
                    ),
                    PGRC: f.links.find((l) => l.bureau === 'PGRC')?.open || 0,
                    RB: f.links.find((l) => l.bureau === 'RB')?.open || 0,
                    AB: f.links.find((l) => l.bureau === 'AB')?.open || 0,
                    total: f.total,
                    cross: f.crossBureauPending,
                  }))}
                />
              )}
            </Card>

            <Card className="flex flex-col p-5" data-tour="promise-card">
              <CardHead
                title="Promise Ledger"
                subtitle="Institution promises, tracked until kept"
                right={
                  <Link to="/promises" className="link inline-flex items-center gap-1 text-xs">
                    Open <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                }
              />
              <div className="flex items-center gap-4">
                <RateRing rate={p.rate} size={96} stroke={10} />
                <dl className="grid flex-1 grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  {[
                    ['Open', p.open],
                    ['Asking', p.awaiting],
                    ['Kept', p.kept + p.partly],
                    ['Broken', p.broken],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs text-ink-muted">{k}</dt>
                      <dd className="text-lg font-extrabold text-ink">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-ink-muted">Next check-ins</p>
              <ul className="flex-1 space-y-2">
                {p.nextDue.map((n) => (
                  <li key={n.id} className="rounded-xl bg-paper-soft/80 px-3 py-2">
                    <p className="truncate text-sm font-semibold text-ink">
                      {n.action}
                      {money(n.amount) && <span className="font-normal text-ink-muted"> · {money(n.amount)}</span>}
                    </p>
                    <p className="truncate text-xs text-ink-muted">
                      {n.institution} · {dueText(n.dueDate, 'pending')}
                    </p>
                  </li>
                ))}
                {!p.nextDue.length && <li className="text-sm text-ink-muted">No open promises.</li>}
              </ul>
            </Card>
          </div>

          {/* Trend + deadlines */}
          <div className="grid gap-4 xl:grid-cols-3 [&>*]:min-w-0">
            <Card className="p-5 xl:col-span-2">
              <CardHead title="New complaints per week" subtitle={`Last ${data.weekly.length} weeks, all bureaus`} right={<ViewToggle view={trendView} setView={setTrendView} label="Trend" />} />
              {trendView === 'chart' ? (
                <TrendArea weekly={data.weekly} />
              ) : (
                <DataTable
                  columns={[
                    { key: 'week', label: 'Week starting' },
                    { key: 'count', label: 'New complaints', num: true },
                  ]}
                  rows={data.weekly.map((w) => ({ week: fmtWeek.format(new Date(w.week)), count: w.count })).reverse()}
                />
              )}
            </Card>

            <Card className="p-5">
              <CardHead title="Deadline health" subtitle="Open cases against their deadlines" />
              <DeadlineRing deadline={data.deadline} />
            </Card>
          </div>

          {/* Breakdown + activity */}
          <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
            <Card className="p-5">
              <CardHead
                title="Breakdown"
                subtitle={{ pipeline: 'Every case by workflow stage', bureau: 'Open cases per bureau (hover for totals)', issue: 'All complaints by issue' }[breakdown]}
                right={
                  <div className="flex rounded-lg bg-paper-deep/70 p-0.5" role="tablist" aria-label="Breakdown">
                    {BREAKDOWN.map((b) => (
                      <button
                        key={b.key}
                        role="tab"
                        aria-selected={breakdown === b.key}
                        onClick={() => setBreakdown(b.key)}
                        className={clsx('rounded-md px-2.5 py-1 text-[0.7rem] font-semibold transition', breakdown === b.key ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink')}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                }
              />
              <AnimatePresence mode="wait">
                <motion.div key={breakdown} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
                  {breakdown === 'pipeline' && <Pipeline pipeline={data.pipeline} />}
                  {breakdown === 'bureau' && (
                    <BarList
                      rows={data.byBureau.map((b) => ({ key: b.bureau, label: bureauName(b.bureau), value: b.open, secondary: b.total, barClass: BUREAU_STYLE[b.bureau]?.bar }))}
                      valueLabel="open"
                      secondary="total"
                    />
                  )}
                  {breakdown === 'issue' && <BarList rows={data.byCategory.slice(0, 7).map((c) => ({ key: c.category, label: categoryLabel(c.category), value: c.total }))} />}
                </motion.div>
              </AnimatePresence>
            </Card>

            <Card className="p-5">
              <CardHead
                title="Live activity"
                right={
                  ['senior_reviewer', 'admin', 'bureau_head'].includes(user.role) && (
                    <Link to="/audit" className="link text-xs">
                      Audit trail
                    </Link>
                  )
                }
              />
              <ul className="relative space-y-3">
                <span className="absolute bottom-2 left-[3px] top-2 w-px bg-paper-line" aria-hidden="true" />
                <AnimatePresence initial={false}>
                  {data.recent.slice(0, 6).map((r, i) => (
                    <motion.li key={r.seq} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="relative flex items-start gap-3">
                      <span className={clsx('relative mt-1.5 h-2 w-2 shrink-0 rounded-full', i === 0 ? 'bg-ember-500' : 'bg-ember-300')}>
                        {i === 0 && <span className="absolute inset-0 animate-ping rounded-full bg-ember-500 opacity-60" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink">
                          <span className="font-semibold">{AUDIT_LABEL[r.action] || r.action}</span>
                          {r.summary && <span className="text-ink-soft"> — {r.summary}</span>}
                        </p>
                        <p className="text-xs text-ink-faint">
                          {r.actorName} · {timeAgo(r.at)}
                        </p>
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </Card>
          </div>
        </motion.div>
      )}
    </Page>
  );
}
