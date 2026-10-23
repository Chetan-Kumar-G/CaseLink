import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { GitMerge } from 'lucide-react';
import { api, errorMessage } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import EvidenceCard from '../components/EvidenceCard.jsx';
import { EmptyState, ErrorState, Page, PageHeader, Skeleton, stagger } from '../components/ui.jsx';

const TABS = [
  { key: 'pending', label: 'Pending review' },
  { key: 'coordination_requested', label: 'Coordination' },
  { key: 'linked', label: 'Linked' },
  { key: 'dismissed', label: 'Dismissed' },
];

export default function Overlaps() {
  const { user } = useAuth();
  const [status, setStatus] = useState('pending');
  const [crossOnly, setCrossOnly] = useState(false);
  const [mine, setMine] = useState(Boolean(user.bureau));
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setData(null);
    setError('');
    api
      .get('/overlaps', { params: { status, crossBureau: crossOnly || undefined, mine: mine || undefined, limit: 50 } })
      .then((r) => setData(r.data))
      .catch((e) => setError(errorMessage(e)));
  }, [status, crossOnly, mine]);
  useEffect(load, [load]);

  const Toggle = ({ on, set, children }) => (
    <button onClick={() => set(!on)} className={clsx('flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition', on ? 'bg-ink text-white ring-ink' : 'bg-white text-ink-soft ring-paper-line hover:ring-ember-300')} aria-pressed={on}>
      <span className={clsx('h-2 w-2 rounded-full', on ? 'bg-ember-400' : 'bg-ink-faint')} />
      {children}
    </button>
  );

  return (
    <Page>
      <PageHeader
        eyebrow="Cross-Bureau Overlap Engine"
        title="Overlap alerts"
        description="Potential duplicate and related cases found by exact identifiers, rules and multilingual semantic matching. Each needs a human decision — nothing is merged automatically."
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-2xl bg-paper-deep/60 p-1" role="tablist" data-tour="ov-tabs">
          {TABS.map((t) => (
            <button key={t.key} role="tab" aria-selected={status === t.key} onClick={() => setStatus(t.key)} className="relative shrink-0 rounded-xl px-4 py-2 text-sm font-semibold">
              {status === t.key && <motion.span layoutId="ov-tab" className="absolute inset-0 rounded-xl bg-white shadow-card" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
              <span className={clsx('relative', status === t.key ? 'text-ink' : 'text-ink-muted')}>{t.label}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" data-tour="ov-filters">
          <Toggle on={crossOnly} set={setCrossOnly}>Cross-bureau only</Toggle>
          {user.bureau && <Toggle on={mine} set={setMine}>My bureau ({user.bureau})</Toggle>}
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {!data && !error && (
        <div className="space-y-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      )}
      {data?.overlaps.length === 0 && (
        <EmptyState icon={GitMerge} title="Nothing here">
          {status === 'pending' ? 'No overlaps are waiting for review with these filters.' : 'No overlaps with this decision yet.'}
        </EmptyState>
      )}
      {data?.overlaps.length > 0 && (
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4" data-tour="ov-list">
          <p className="text-sm text-ink-muted">{data.total} overlap{data.total === 1 ? '' : 's'}</p>
          {data.overlaps.map((o) => (
            <EvidenceCard key={o.id} overlap={o} showInstitution onDecided={load} />
          ))}
        </motion.div>
      )}
    </Page>
  );
}
