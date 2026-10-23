import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, FileStack, Lock, Plus, Search } from 'lucide-react';
import { api, errorMessage } from '../lib/api.js';
import { dueLabel, formatDate } from '../lib/format.js';
import { useAuth, useMeta } from '../context/AuthContext.jsx';
import { BureauBadge, DueBadge, EscalationBadge, PriorityBadge, StatusBadge } from '../components/badges.jsx';
import { Button, EmptyState, ErrorState, Page, PageHeader, Skeleton } from '../components/ui.jsx';

export default function Cases() {
  const { user } = useAuth();
  const { meta, categoryLabel } = useMeta();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState(params.get('q') || '');

  const filters = Object.fromEntries(['bureau', 'status', 'category', 'q', 'page', 'overdue'].map((k) => [k, params.get(k) || '']));
  const page = Number(filters.page) || 1;

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setParams(next);
  };

  useEffect(() => {
    setData(null);
    setError('');
    api
      .get('/cases', { params: { ...filters, limit: 15 } })
      .then((r) => setData(r.data))
      .catch((e) => setError(errorMessage(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.toString()]);

  const goPage = (p) => setParams(Object.fromEntries(Object.entries({ ...filters, page: String(p) }).filter(([, v]) => v)));
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <Page>
      <PageHeader
        eyebrow="Tracking"
        title="Cases"
        description="All institution-related cases across bureaus. Complainant details are masked for cases outside your bureau."
        actions={
          ['officer', 'bureau_head', 'admin'].includes(user.role) && (
            <Link to="/cases/new">
              <Button icon={Plus}>Register case</Button>
            </Link>
          )
        }
      />

      <div className="card mb-5 grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]" data-tour="cases-filters">
        <form
          className="relative"
          onSubmit={(e) => {
            e.preventDefault();
            setFilter('q', q.trim());
          }}
        >
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input className="input pl-10" placeholder="Case ref, subject or Permanent ID" value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => q.trim() !== filters.q && setFilter('q', q.trim())} />
        </form>
        <select className="input" value={filters.bureau} onChange={(e) => setFilter('bureau', e.target.value)} aria-label="Bureau">
          <option value="">All bureaus</option>
          {meta?.bureaus.map((b) => (
            <option key={b.code} value={b.code}>
              {b.code} — {b.name}
            </option>
          ))}
        </select>
        <select className="input" value={filters.status} onChange={(e) => setFilter('status', e.target.value)} aria-label="Status">
          <option value="">Any status</option>
          <option value="open">All open</option>
          {meta?.statuses.map((s) => (
            <option key={s.code} value={s.code}>
              {s.label}
            </option>
          ))}
        </select>
        <select className="input" value={filters.category} onChange={(e) => setFilter('category', e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {meta?.categories.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {error && <ErrorState message={error} />}
      {!data && !error && <Skeleton className="h-96" />}
      {data?.cases.length === 0 && <EmptyState icon={FileStack} title="No cases match these filters">Try clearing a filter.</EmptyState>}

      {data?.cases.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} data-tour="cases-list">
          {/* Desktop table */}
          <div className="card hidden overflow-hidden md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-paper-line bg-paper-soft/80 text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Case</th>
                  <th className="px-4 py-3 font-semibold">Institution</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Deadline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-line">
                {data.cases.map((c, i) => (
                  <motion.tr
                    key={c.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.025 }}
                    onClick={() => navigate(`/cases/${c.id}`)}
                    className="cursor-pointer transition hover:bg-ember-50/50"
                  >
                    <td className="max-w-xs px-4 py-3">
                      <div className="flex items-center gap-2">
                        <BureauBadge code={c.bureau} />
                        <Link to={`/cases/${c.id}`} className="font-mono text-xs text-ink-muted hover:text-ember-700" onClick={(e) => e.stopPropagation()}>
                          {c.caseRef}
                        </Link>
                        {c.access === 'masked' && <Lock className="h-3 w-3 text-ink-faint" aria-label="Complainant masked" />}
                      </div>
                      <p className={clsx('mt-1 truncate font-semibold text-ink', c.language !== 'en' && 'font-hi')}>{c.subject}</p>
                    </td>
                    <td className="max-w-[14rem] px-4 py-3">
                      <p className="truncate text-ink-soft">{c.institution?.name}</p>
                      <p className="font-mono text-xs text-ink-faint">{c.permanentId}</p>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      {categoryLabel(c.category)}
                      <div className="mt-1">
                        <PriorityBadge priority={c.priority} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-muted">
                      {dueLabel(c.dueDate, c.isOpen) ? <DueBadge due={dueLabel(c.dueDate, c.isOpen)} /> : formatDate(c.closedAt || c.updatedAt)}
                      {c.isOpen && c.escalationLevel > 0 && (
                        <div className="mt-1">
                          <EscalationBadge level={c.escalationLevel} />
                        </div>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {data.cases.map((c) => (
              <Link key={c.id} to={`/cases/${c.id}`} className="card block p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <BureauBadge code={c.bureau} />
                    <span className="font-mono text-xs text-ink-muted">{c.caseRef}</span>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
                <p className={clsx('mt-2 font-semibold text-ink', c.language !== 'en' && 'font-hi')}>{c.subject}</p>
                <p className="mt-1 truncate text-xs text-ink-muted">{c.institution?.name}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <PriorityBadge priority={c.priority} />
                  <DueBadge due={dueLabel(c.dueDate, c.isOpen)} />
                  {c.isOpen && <EscalationBadge level={c.escalationLevel} />}
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-ink-muted">
            <span>
              {data.total} case{data.total === 1 ? '' : 's'}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => goPage(page - 1)} aria-label="Previous page">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="tabular-nums">
                {page} / {pages}
              </span>
              <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => goPage(page + 1)} aria-label="Next page">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </Page>
  );
}
