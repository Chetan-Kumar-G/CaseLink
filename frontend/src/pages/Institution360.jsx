import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { AlarmClock, Building2, Check, Copy, FileStack, GitMerge, HandCoins, History, Layers, MapPin, Network } from 'lucide-react';
import { PromiseRow, RateRing } from '../components/promises.jsx';
import { api, errorMessage } from '../lib/api.js';
import { dueLabel, formatDate } from '../lib/format.js';
import { useMeta } from '../context/AuthContext.jsx';
import EvidenceCard from '../components/EvidenceCard.jsx';
import Timeline from '../components/Timeline.jsx';
import { BarList } from '../components/BarList.jsx';
import { BUREAU_STYLE, BureauBadge, DueBadge, StatusBadge } from '../components/badges.jsx';
import { Card, EmptyState, ErrorState, Page, Skeleton, StatTile, stagger } from '../components/ui.jsx';

function CopyId({ value }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => navigator.clipboard?.writeText(value).then(() => {
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      })}
      className="inline-flex items-center gap-1.5 rounded-lg bg-white/70 px-2 py-1 font-mono text-xs font-medium text-ink-soft ring-1 ring-paper-line transition hover:ring-ember-300"
      title="Copy Permanent ID"
    >
      {value}
      {done ? <Check className="h-3.5 w-3.5 text-sage-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function BureauLane({ code, cases }) {
  const { bureauName, categoryLabel } = useMeta();
  const s = BUREAU_STYLE[code] || BUREAU_STYLE.RB;
  return (
    <Card className="flex flex-col overflow-hidden">
      <div className={clsx('flex items-center justify-between gap-2 px-4 py-3', s.soft)}>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink">{bureauName(code)}</p>
          <p className="text-xs text-ink-muted">{cases.length} case{cases.length === 1 ? '' : 's'}</p>
        </div>
        <BureauBadge code={code} />
      </div>
      <ul className="flex-1 divide-y divide-paper-line">
        {cases.map((c) => (
          <li key={c.id}>
            <Link to={`/cases/${c.id}`} className="block px-4 py-3 transition hover:bg-paper-soft/70">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-ink-muted">{c.caseRef}</span>
                <StatusBadge status={c.status} />
              </div>
              <p className={clsx('mt-1 line-clamp-2 text-sm font-semibold text-ink', c.language !== 'en' && 'font-hi')}>{c.subject}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
                <span>{categoryLabel(c.category)}</span>
                <span>· {formatDate(c.createdAt)}</span>
                <DueBadge due={dueLabel(c.dueDate, c.isOpen)} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const TABS = [
  { key: 'lanes', label: 'By bureau', icon: Layers },
  { key: 'overlaps', label: 'Overlaps', icon: GitMerge },
  { key: 'promises', label: 'Promises', icon: HandCoins },
  { key: 'timeline', label: 'Timeline', icon: History },
];

export default function Institution360() {
  const { permanentId } = useParams();
  const { meta, categoryLabel } = useMeta();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('lanes');

  const load = useCallback(() => {
    setError('');
    api.get(`/institutions/${encodeURIComponent(permanentId)}`).then((r) => setData(r.data)).catch((e) => setError(errorMessage(e)));
  }, [permanentId]);
  useEffect(load, [load]);

  if (error) {
    return (
      <Page>
        <ErrorState message={error} onRetry={load} />
      </Page>
    );
  }
  if (!data) {
    return (
      <Page>
        <Skeleton className="mb-6 h-40" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </Page>
    );
  }

  const { institution: inst, stats, cases, overlaps, timeline, promises } = data;
  const record = promises?.record;
  const bureauOrder = (meta?.bureaus || []).map((b) => b.code);
  const lanes = bureauOrder.filter((b) => cases.some((c) => c.bureau === b));
  const pendingCross = overlaps.filter((o) => o.status === 'pending' && o.crossBureau).length;

  const onDecided = (updated) => {
    setData((d) => ({ ...d, overlaps: d.overlaps.map((o) => (o.id === updated.id ? updated : o)), stats: { ...d.stats, pendingOverlaps: Math.max(0, d.stats.pendingOverlaps - 1) } }));
    load();
  };

  return (
    <Page>
      <motion.section data-tour="i360-hero" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative mb-6 overflow-hidden rounded-[1.75rem] border border-ember-100 bg-gradient-to-br from-white via-ember-50 to-ember-100/70 p-5 shadow-card sm:p-7">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-ember-200/40 blur-3xl" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-ember-400 to-ember-600 text-white shadow-lift">
              <Building2 className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-ember-600">Institution 360</p>
              <h1 className="mt-1 text-2xl font-extrabold leading-tight tracking-tight text-ink sm:text-3xl">{inst.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                <CopyId value={inst.permanentId} />
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {inst.city}, {inst.state}
                </span>
                <span>· {inst.type}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 xl:justify-end">
            {record?.rate != null && (
              <button onClick={() => setTab('promises')} className={`chip ring-1 ring-inset ${record.rate >= 75 ? 'bg-sage-50 text-sage-700 ring-sage-100' : record.rate >= 50 ? 'bg-honey-50 text-honey-700 ring-honey-100' : 'bg-rosewood-50 text-rosewood-700 ring-rosewood-100'}`} title="Promise Kept Rate">
                <HandCoins className="h-3.5 w-3.5" /> {record.rate}% promises kept
              </button>
            )}
            {lanes.map((b) => (
              <BureauBadge key={b} code={b} full />
            ))}
          </div>
        </div>
        {pendingCross > 0 && (
          <motion.button
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            onClick={() => setTab('overlaps')}
            className="relative mt-5 flex w-full items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-left text-sm text-white transition hover:bg-ink-soft"
          >
            <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ember-500">
              <span className="absolute inset-0 animate-ping rounded-full bg-ember-500 opacity-40" />
              <Network className="relative h-4 w-4" />
            </span>
            <span>
              <b>{pendingCross} cross-bureau overlap{pendingCross > 1 ? 's' : ''}</b> {pendingCross > 1 ? 'need' : 'needs'} review — the same issue may be handled by more than one bureau.
            </span>
          </motion.button>
        )}
      </motion.section>

      <motion.div variants={stagger} initial="hidden" animate="show" className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" data-tour="i360-stats">
        <StatTile icon={FileStack} label="Open cases" value={stats.open} hint={`${stats.total} total`} />
        <StatTile icon={Layers} label="Bureaus involved" value={stats.bureausInvolved} tone="plum" />
        <StatTile icon={GitMerge} label="Pending overlaps" value={stats.pendingOverlaps} tone="teal" pulse />
        <StatTile icon={AlarmClock} label="Overdue" value={stats.overdue} tone="rosewood" />
      </motion.div>

      <div className="mb-5 no-scrollbar flex gap-1 overflow-x-auto rounded-2xl bg-paper-deep/60 p-1 sm:inline-flex" role="tablist" data-tour="i360-tabs">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className="relative flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold">
            {tab === t.key && <motion.span layoutId="i360-tab" className="absolute inset-0 rounded-xl bg-white shadow-card" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
            <t.icon className={clsx('relative h-4 w-4', tab === t.key ? 'text-ember-600' : 'text-ink-muted')} />
            <span className={clsx('relative', tab === t.key ? 'text-ink' : 'text-ink-muted')}>{t.label}</span>
            {t.key === 'overlaps' && stats.pendingOverlaps > 0 && <span className="relative rounded-full bg-ember-500 px-1.5 text-[0.7rem] font-bold text-white">{stats.pendingOverlaps}</span>}
          </button>
        ))}
      </div>

      {tab === 'lanes' &&
        (cases.length === 0 ? (
          <EmptyState icon={FileStack} title="No cases yet">No complaints have been registered for this institution.</EmptyState>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[1fr_280px] [&>*]:min-w-0">
            <motion.div variants={stagger} initial="hidden" animate="show" className={clsx('grid gap-4', lanes.length > 1 && 'md:grid-cols-2', lanes.length > 2 && 'xl:grid-cols-3')}>
              {lanes.map((b) => (
                <BureauLane key={b} code={b} cases={cases.filter((c) => c.bureau === b)} />
              ))}
            </motion.div>
            <motion.div variants={stagger} initial="hidden" animate="show">
              <Card className="p-5">
                <h2 className="font-bold text-ink">Issue categories</h2>
                <p className="mb-4 text-xs text-ink-muted">Across all bureaus</p>
                <BarList rows={Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ key: k, label: categoryLabel(k), value: v }))} />
              </Card>
            </motion.div>
          </div>
        ))}

      {tab === 'overlaps' &&
        (overlaps.length === 0 ? (
          <EmptyState icon={GitMerge} title="No overlaps detected">No duplicate or related cases have been found for this institution.</EmptyState>
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
            {overlaps.map((o) => (
              <EvidenceCard key={o.id} overlap={o} onDecided={onDecided} />
            ))}
          </motion.div>
        ))}

      {tab === 'promises' && (
        <div className="grid gap-4 xl:grid-cols-[300px_1fr] [&>*]:min-w-0">
          <Card className="p-5" initial="hidden" animate="show">
            <h2 className="font-bold text-ink">Promise record</h2>
            <p className="text-xs text-ink-muted">Promises this institution made in writing, across all bureaus</p>
            <div className="mt-4 flex items-center gap-4">
              <RateRing rate={record?.rate ?? null} size={104} stroke={10} />
              <ul className="space-y-1 text-sm text-ink-soft">
                <li><b className="text-ink">{record?.kept || 0}</b> kept</li>
                <li><b className="text-ink">{record?.partly_kept || 0}</b> partly kept</li>
                <li><b className="text-ink">{record?.broken || 0}</b> broken</li>
                <li><b className="text-ink">{record?.open || 0}</b> still open</li>
              </ul>
            </div>
            <p className="mt-4 rounded-xl bg-plum-50 px-3 py-2 text-xs text-plum-700">Shown to the Approval Bureau at approval renewal, next to the grievance history.</p>
            {promises?.templateReplies?.length > 0 && (
              <div className="mt-3 rounded-xl bg-honey-50 px-3 py-2 text-xs text-honey-700">
                <b>Template replies:</b> {promises.templateReplies.length} reply{promises.templateReplies.length > 1 ? 'ies' : ''} reused near-identical text sent to other complainants ({promises.templateReplies.map((t) => t.caseRef).join(', ')}).
              </div>
            )}
          </Card>
          {promises?.entries?.length ? (
            <ul className="space-y-3">
              {promises.entries.map((e) => (
                <PromiseRow key={e._id} entry={e} demo={Boolean(meta?.demo?.controls)} onChanged={load} />
              ))}
            </ul>
          ) : (
            <EmptyState icon={HandCoins} title="No promises recorded">This institution has not resolved any complaint on a promise.</EmptyState>
          )}
        </div>
      )}

      {tab === 'timeline' && (
        <Card className="p-5 sm:p-6" initial="hidden" animate="show">
          <h2 className="mb-1 font-bold text-ink">Unified timeline</h2>
          <p className="mb-5 text-xs text-ink-muted">Every action on every case of this institution, across bureaus</p>
          {timeline.length ? <Timeline events={timeline} showCase /> : <p className="text-sm text-ink-muted">No activity yet.</p>}
        </Card>
      )}
    </Page>
  );
}
