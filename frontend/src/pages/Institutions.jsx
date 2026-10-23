import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, Building2, GitMerge, HandCoins, MapPin, Search } from 'lucide-react';
import { api, errorMessage } from '../lib/api.js';
import { timeAgo } from '../lib/format.js';
import { BureauBadge } from '../components/badges.jsx';
import { EmptyState, ErrorState, Page, PageHeader, Skeleton, fadeUp, stagger } from '../components/ui.jsx';

export default function Institutions() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const [term, setTerm] = useState(q);
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => setTerm(q), [q]);

  useEffect(() => {
    setItems(null);
    setError('');
    const t = setTimeout(() => {
      api
        .get('/institutions', { params: { q } })
        .then((r) => setItems(r.data.institutions))
        .catch((e) => setError(errorMessage(e)));
    }, 150);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <Page>
      <PageHeader eyebrow="Institution 360" title="Institutions" description="Every institution is identified by its AICTE Permanent ID. Open one to see its cases across all bureaus." />

      <form
        data-tour="inst-search"
        className="relative mb-6 max-w-xl"
        onSubmit={(e) => {
          e.preventDefault();
          setParams(term.trim() ? { q: term.trim() } : {});
        }}
      >
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <input className="input pl-10" placeholder="Name, city, state or Permanent ID" value={term} onChange={(e) => setTerm(e.target.value)} onBlur={() => setParams(term.trim() ? { q: term.trim() } : {})} />
      </form>

      {error && <ErrorState message={error} />}
      {!items && !error && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      )}
      {items?.length === 0 && <EmptyState icon={Building2} title="No institutions found">Try a different name or Permanent ID.</EmptyState>}

      {items?.length > 0 && (
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-tour="inst-grid">
          {items.map((i) => (
            <motion.div key={i.id} variants={fadeUp} whileHover={{ y: -3 }}>
              <Link to={`/institutions/${i.permanentId}`} className="card group flex h-full flex-col p-5 transition-shadow hover:shadow-lift">
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-ember-100 to-ember-200 text-ember-700">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold leading-snug text-ink group-hover:text-ember-800">{i.name}</p>
                    <p className="mt-0.5 font-mono text-xs text-ink-muted">{i.permanentId}</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-faint transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ember-600" />
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-muted">
                  <MapPin className="h-3.5 w-3.5" /> {i.city}, {i.state} · {i.type}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-1.5">
                  {i.stats.bureaus.map((b) => (
                    <BureauBadge key={b} code={b} />
                  ))}
                  {i.promises?.rate != null && (
                    <span className={`chip ${i.promises.rate >= 75 ? 'bg-sage-50 text-sage-700' : i.promises.rate >= 50 ? 'bg-honey-50 text-honey-700' : 'bg-rosewood-50 text-rosewood-700'}`} title="Promise Kept Rate">
                      <HandCoins className="h-3.5 w-3.5" /> {i.promises.rate}% kept
                    </span>
                  )}
                  {i.stats.pendingOverlaps > 0 && (
                    <span className="chip bg-ember-500 text-white">
                      <GitMerge className="h-3.5 w-3.5" /> {i.stats.pendingOverlaps} alert{i.stats.pendingOverlaps > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="mt-auto flex items-center justify-between border-t border-paper-line pt-3 text-xs text-ink-muted" style={{ marginTop: '1rem' }}>
                  <span>
                    <b className="text-ink">{i.stats.open}</b> open · {i.stats.total} total
                  </span>
                  <span>{i.stats.lastActivity ? `Active ${timeAgo(i.stats.lastActivity)}` : 'No cases'}</span>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}
    </Page>
  );
}
