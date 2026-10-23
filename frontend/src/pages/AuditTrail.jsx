import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Link2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { api, errorMessage } from '../lib/api.js';
import { AUDIT_LABEL, ROLE_LABEL, formatDateTime } from '../lib/format.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, ErrorState, Page, PageHeader, Skeleton } from '../components/ui.jsx';

const FILTERS = [
  ['', 'All'],
  ['auth', 'Sign-ins'],
  ['case', 'Cases'],
  ['overlap', 'Overlaps'],
  ['institution', 'Institution views'],
];

export default function AuditTrail() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [chain, setChain] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const canVerify = ['senior_reviewer', 'admin'].includes(user.role);

  const load = useCallback(() => {
    setData(null);
    setError('');
    api.get('/audit', { params: { page, action: action || undefined } }).then((r) => setData(r.data)).catch((e) => setError(errorMessage(e)));
  }, [page, action]);
  useEffect(load, [load]);

  const verify = async () => {
    setVerifying(true);
    try {
      const { data: r } = await api.get('/audit/verify');
      setChain(r);
    } catch (e) {
      setChain({ valid: false, reason: errorMessage(e) });
    } finally {
      setVerifying(false);
    }
  };
  useEffect(() => {
    if (canVerify) verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <Page>
      <PageHeader
        eyebrow="Accountability"
        title="Audit trail"
        description={user.role === 'bureau_head' ? `Activity by ${user.bureau} staff. Entries are append-only and hash-chained.` : 'Every sign-in, view, change and decision. Entries are append-only and hash-chained, so any tampering is detectable.'}
      />

      {canVerify && (
        <motion.div data-tour="audit-chain" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={clsx('card mb-5 flex flex-col gap-3 p-4 sm:flex-row sm:items-center', chain && !chain.valid && 'border-rosewood-100 bg-rosewood-50')}>
          <motion.div
            key={chain ? String(chain.valid) : 'pending'}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
            className={clsx('grid h-12 w-12 shrink-0 place-items-center rounded-2xl', !chain ? 'bg-paper-deep text-ink-muted' : chain.valid ? 'bg-sage-500 text-white' : 'bg-rosewood-500 text-white')}
          >
            {chain && !chain.valid ? <ShieldAlert className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
          </motion.div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink">{!chain ? 'Verifying audit chain…' : chain.valid ? 'Audit chain intact' : 'Audit chain broken'}</p>
            <p className="break-all text-xs text-ink-muted">
              {!chain ? 'Recomputing every entry hash' : chain.valid ? `${chain.count} entries verified · head ${chain.headHash?.slice(0, 16)}…` : `${chain.reason}${chain.brokenAt ? ` at entry #${chain.brokenAt}` : ''}`}
            </p>
          </div>
          <Button variant="secondary" size="sm" loading={verifying} onClick={verify}>
            Verify again
          </Button>
        </motion.div>
      )}

      <div className="no-scrollbar mb-4 flex gap-1.5 overflow-x-auto pb-1" data-tour="audit-filters">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => {
              setAction(key);
              setPage(1);
            }}
            className={clsx('shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition', action === key ? 'bg-ember-500 text-white ring-ember-500' : 'bg-white text-ink-soft ring-paper-line hover:ring-ember-300')}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <ErrorState message={error} onRetry={load} />}
      {!data && !error && <Skeleton className="h-96" />}
      {data && (
        <div className="card overflow-hidden" data-tour="audit-list">
          <ul className="divide-y divide-paper-line">
            {data.entries.map((e, i) => (
              <motion.li key={e.seq} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.015 }} className="grid gap-1 px-4 py-3 sm:grid-cols-[4rem_10rem_1fr_auto] sm:items-center sm:gap-4">
                <span className="font-mono text-xs text-ink-faint">#{e.seq}</span>
                <span className="text-xs text-ink-muted">{formatDateTime(e.at)}</span>
                <div className="min-w-0">
                  <p className="text-sm text-ink">
                    <span className="font-semibold">{AUDIT_LABEL[e.action] || e.action}</span>
                    {e.summary && <span className="text-ink-soft"> — {e.summary}</span>}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {e.actorName}
                    {e.actorRole && e.actorRole !== 'system' && e.actorRole !== 'none' && ` · ${ROLE_LABEL[e.actorRole] || e.actorRole}`}
                    {e.actorBureau && ` · ${e.actorBureau}`}
                    {e.ip && ` · ${e.ip}`}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 font-mono text-[0.7rem] text-ink-faint" title={`hash ${e.hash}\nprev ${e.prevHash}`}>
                  <Link2 className="h-3 w-3" />
                  {e.hash.slice(0, 10)}
                </span>
              </motion.li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-paper-line px-4 py-3 text-sm text-ink-muted">
            <span>{data.total} entries</span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Newer entries">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="tabular-nums">
                {page} / {pages}
              </span>
              <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Older entries">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
