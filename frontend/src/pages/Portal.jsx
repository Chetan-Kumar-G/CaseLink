import { useCallback, useEffect, useState } from 'react';
import { Link, Outlet, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { AlarmClock, ArrowLeft, ChevronRight, Compass, FileText, HandCoins, Hourglass, Inbox, Lock, LogOut, MessageSquareReply, Paperclip, Undo2 } from 'lucide-react';
import { PromiseStatus, dueText, money } from '../components/promises.jsx';
import { TourProvider, useTour } from '../components/Tour.jsx';
import { api, errorMessage } from '../lib/api.js';
import { dueLabel, formatDate, formatDateTime } from '../lib/format.js';
import { useAuth, useMeta } from '../context/AuthContext.jsx';
import { Logo } from '../components/Logo.jsx';
import NotificationBell from '../components/NotificationBell.jsx';
import { ResponseForm } from '../components/ClosureGuard.jsx';
import { BureauBadge, DueBadge, StatusBadge } from '../components/badges.jsx';
import { Button, Card, EmptyState, ErrorState, Page, PageHeader, Skeleton, StatTile, stagger } from '../components/ui.jsx';

function TourButton() {
  const { start } = useTour();
  return (
    <button onClick={start} data-tour="tour-replay" className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-white" aria-label="Take the tour">
      <Compass className="h-4 w-4" /> <span className="hidden sm:inline">Tour</span>
    </button>
  );
}

export function PortalLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <TourProvider>
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-paper-line/80 bg-paper/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6">
          <Link to="/portal">
            <Logo />
          </Link>
          <span className="hidden rounded-full bg-plum-50 px-2.5 py-1 text-xs font-bold text-plum-700 sm:inline">Institution portal</span>
          <div className="ml-auto flex items-center gap-1">
            <TourButton />
            <span data-tour="bell">
              <NotificationBell />
            </span>
            <button
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
              className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-white"
            >
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>
      <main>
        <Outlet context={{ user }} />
      </main>
    </div>
    </TourProvider>
  );
}

export function PortalHome() {
  const { categoryLabel } = useMeta();
  const [summary, setSummary] = useState(null);
  const [cases, setCases] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.get('/portal/summary'), api.get('/portal/cases')])
      .then(([s, c]) => {
        setSummary(s.data);
        setCases(c.data.cases);
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);

  return (
    <Page className="max-w-5xl">
      <PageHeader
        eyebrow="Institution portal"
        title={summary ? summary.institution.name : 'Your institution'}
        description={summary ? `AICTE Permanent ID ${summary.institution.permanentId} · ${summary.institution.city}, ${summary.institution.state}` : undefined}
      />
      {error && <ErrorState message={error} />}
      {!cases && !error && <Skeleton className="h-80" />}
      {summary && (
        <motion.div variants={stagger} initial="hidden" animate="show" className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" data-tour="portal-stats">
          <StatTile icon={Inbox} label="Awaiting your reply" value={summary.counts.awaitingYou} tone="ember" pulse />
          <StatTile icon={FileText} label="Open complaints" value={summary.counts.open} tone="plum" />
          <StatTile icon={AlarmClock} label="Past deadline" value={summary.counts.overdue} tone="rosewood" />
          <StatTile icon={Hourglass} label="All complaints" value={summary.counts.total} tone="teal" />
        </motion.div>
      )}
      {cases?.length === 0 && <EmptyState icon={Inbox} title="No complaints">There are no complaints against your institution.</EmptyState>}
      {cases?.length > 0 && (
        <motion.ul variants={stagger} initial="hidden" animate="show" className="space-y-3" data-tour="portal-cases">
          {cases.map((c) => (
            <motion.li key={c.id} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}>
              <Link to={`/portal/cases/${c.id}`} className={clsx('card group flex items-center gap-4 p-4 transition hover:shadow-lift', c.status === 'awaiting_institution' && 'ring-2 ring-ember-200')}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <BureauBadge code={c.bureau} />
                    <span className="font-mono text-xs text-ink-muted">{c.caseRef}</span>
                    <StatusBadge status={c.status} />
                    {c.status === 'awaiting_institution' && <span className="chip bg-ember-500 text-white">Your reply needed</span>}
                  </div>
                  <p className={clsx('mt-1.5 font-semibold text-ink group-hover:text-ember-800', c.language !== 'en' && 'font-hi')}>{c.subject}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                    <span>{categoryLabel(c.category)}</span>
                    <span>· received {formatDate(c.createdAt)}</span>
                    <DueBadge due={dueLabel(c.dueDate, c.isOpen)} />
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-ember-600" />
              </Link>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </Page>
  );
}

export function PortalCase() {
  const { id } = useParams();
  const { categoryLabel, bureauName } = useMeta();
  const [c, setC] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    api.get(`/portal/cases/${id}`).then((r) => setC(r.data.case)).catch((e) => setError(errorMessage(e)));
  }, [id]);
  useEffect(load, [load]);

  if (error) return <Page className="max-w-4xl"><ErrorState message={error} /></Page>;
  if (!c) return <Page className="max-w-4xl"><Skeleton className="h-96" /></Page>;

  const lastRequest = [...c.responses].reverse().find((r) => r.decision?.outcome === 'request_more');

  return (
    <Page className="max-w-4xl">
      <Link to="/portal" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ember-700">
        <ArrowLeft className="h-4 w-4" /> All complaints
      </Link>
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
        <Card className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <BureauBadge code={c.bureau} full />
            <span className="font-mono text-sm text-ink-muted">{c.caseRef}</span>
            <StatusBadge status={c.status} />
            <DueBadge due={dueLabel(c.dueDate, c.isOpen)} />
          </div>
          <h1 className={clsx('mt-3 text-2xl font-extrabold tracking-tight text-ink', c.language !== 'en' && 'font-hi')}>{c.subject}</h1>
          <p className="mt-1 text-xs text-ink-muted">
            {categoryLabel(c.category)} · received {formatDate(c.createdAt)} · handled by {bureauName(c.bureau)}
          </p>
          <p className={clsx('mt-4 whitespace-pre-line leading-relaxed text-ink-soft', c.language !== 'en' && 'font-hi')}>{c.description}</p>
          <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-faint">
            <Lock className="h-3.5 w-3.5" /> The complainant’s identity is not shared through the portal.
          </p>
        </Card>

        {c.commitments?.length > 0 && (
          <Card className="p-5 sm:p-6" data-tour="portal-commitments">
            <h2 className="flex items-center gap-2 font-bold text-ink">
              <HandCoins className="h-5 w-5 text-ember-600" /> Your commitments
            </h2>
            <p className="mt-1 text-xs text-ink-muted">AICTE recorded these promises from your reply. On each date the complainant is asked whether it was kept; if not, the complaint reopens.</p>
            <ul className="mt-3 space-y-2.5">
              {c.commitments.map((p) => (
                <li key={p.id} className="rounded-xl border border-paper-line p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <PromiseStatus status={p.status} />
                    <span className="font-semibold text-ink">{p.action}</span>
                    {money(p.amount) && <span className="chip bg-paper-soft text-ink-soft">{money(p.amount)}</span>}
                    <span className="ml-auto text-xs text-ink-muted">{dueText(p.dueDate, p.status)}</span>
                  </div>
                  <p className="mt-1.5 text-sm italic text-ink-soft">“{p.text}”</p>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {lastRequest && c.canRespond && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 rounded-2xl border border-teal-100 bg-teal-50 p-4 text-sm">
            <Undo2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
            <div>
              <p className="font-bold text-teal-700">AICTE has asked for further action</p>
              <p className="mt-0.5 text-ink-soft">“{lastRequest.decision.reason}”</p>
            </div>
          </motion.div>
        )}

        <Card className="p-5 sm:p-6" data-tour="portal-responses">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-bold text-ink">Your responses</h2>
            {c.canRespond ? (
              <Button icon={MessageSquareReply} onClick={() => setOpen(true)}>
                Submit response
              </Button>
            ) : (
              c.isOpen && <span className="text-sm text-ink-muted">Your latest response is with AICTE for review.</span>
            )}
          </div>
          {c.responses.length === 0 ? (
            <p className="text-sm text-ink-muted">No response submitted yet.</p>
          ) : (
            <ol className="space-y-4">
              {[...c.responses].reverse().map((r) => (
                <li key={r.id} className="rounded-2xl border border-paper-line bg-paper/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
                    <span>{formatDateTime(r.at)}</span>
                    {r.decision ? (
                      <span className={clsx('chip', r.decision.outcome === 'accept' ? 'bg-sage-50 text-sage-700' : 'bg-teal-50 text-teal-700')}>
                        {r.decision.outcome === 'accept' ? 'Accepted by AICTE' : 'More action requested'}
                      </span>
                    ) : (
                      <span className="chip bg-honey-50 text-honey-700">Under review</span>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-ink">{r.text}</p>
                  {r.evidence?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {r.evidence.map((e, i) => (
                        <span key={i} className="chip bg-white text-ink-soft ring-1 ring-inset ring-paper-line">
                          <Paperclip className="h-3 w-3" /> {e.reference || e.type}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Card>
      </motion.div>
      <ResponseForm open={open} onClose={() => setOpen(false)} endpoint={`/portal/cases/${c.id}/responses`} onSaved={() => load()} portal />
    </Page>
  );
}
