import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { Building2, CalendarClock, GitMerge, Lock, Mail, MessageSquarePlus, Phone, RefreshCcw, User, UserCheck } from 'lucide-react';
import { api, errorMessage } from '../lib/api.js';
import { dueLabel, formatDate } from '../lib/format.js';
import { useMeta } from '../context/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import EvidenceCard from '../components/EvidenceCard.jsx';
import ClosureGuard from '../components/ClosureGuard.jsx';
import { PromiseRow } from '../components/promises.jsx';
import Timeline from '../components/Timeline.jsx';
import { BureauBadge, DueBadge, EscalationBadge, PriorityBadge, StatusBadge } from '../components/badges.jsx';
import { Button, Card, ErrorState, Field, Modal, Page, Skeleton, stagger } from '../components/ui.jsx';

function Info({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
      <div className="min-w-0">
        <p className="text-xs text-ink-muted">{label}</p>
        <div className="break-words text-sm font-medium text-ink">{children}</div>
      </div>
    </div>
  );
}

export default function CaseDetail() {
  const { id } = useParams();
  const { meta, statusLabel, categoryLabel, channelLabel, bureauName } = useMeta();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [statusOpen, setStatusOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState('');
  const [note, setNote] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState('');
  const [formError, setFormError] = useState('');

  const load = useCallback(() => {
    setError('');
    api.get(`/cases/${id}`).then((r) => setData(r.data)).catch((e) => setError(errorMessage(e)));
  }, [id]);
  useEffect(load, [load]);

  if (error) return <Page><ErrorState message={error} onRetry={load} /></Page>;
  if (!data) return <Page><Skeleton className="mb-4 h-48" /><Skeleton className="h-80" /></Page>;

  const c = data.case;
  const history = [...c.history].reverse();

  const changeStatus = async () => {
    setBusy('status');
    setFormError('');
    try {
      await api.patch(`/cases/${id}/status`, { status: nextStatus, note });
      toast(`Status changed to ${statusLabel(nextStatus)}`);
      setStatusOpen(false);
      setNote('');
      load();
    } catch (err) {
      setFormError(err.response?.data?.fields?.note || errorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const addNote = async (e) => {
    e.preventDefault();
    if (comment.trim().length < 3) return;
    setBusy('note');
    try {
      await api.post(`/cases/${id}/notes`, { note: comment });
      setComment('');
      toast('Note added');
      load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy('');
    }
  };

  const rescan = async () => {
    setBusy('rescan');
    try {
      const { data: r } = await api.post(`/cases/${id}/rescan`);
      toast(`Re-scan complete — ${r.overlaps.length} overlap${r.overlaps.length === 1 ? '' : 's'}${r.semantic.ran ? '' : ' (semantic layer offline)'}`, r.semantic.ran ? 'success' : 'info');
      load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy('');
    }
  };

  return (
    <Page>
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-5">
          <Card className="p-5 sm:p-6" data-tour="case-header">
            <div className="flex flex-wrap items-center gap-2">
              <BureauBadge code={c.bureau} full />
              <span className="font-mono text-sm font-medium text-ink-muted">{c.caseRef}</span>
              <StatusBadge status={c.status} />
              <PriorityBadge priority={c.priority} />
              <DueBadge due={dueLabel(c.dueDate, c.isOpen)} />
              {c.isOpen && <EscalationBadge level={c.escalationLevel} />}
            </div>
            <h1 className={clsx('mt-3 text-2xl font-extrabold leading-snug tracking-tight text-ink', c.language !== 'en' && 'font-hi')} lang={c.language === 'hi' ? 'hi' : undefined}>
              {c.subject}
            </h1>
            <p className={clsx('mt-3 whitespace-pre-line text-[0.95rem] leading-relaxed text-ink-soft', c.language !== 'en' && 'font-hi')} lang={c.language === 'hi' ? 'hi' : undefined}>
              {c.description}
            </p>
            {c.canEdit && (
              <div className="mt-5 flex flex-wrap gap-2 border-t border-paper-line pt-4">
                {c.allowedTransitions.length > 0 && (
                  <Button
                    icon={RefreshCcw}
                    onClick={() => {
                      setNextStatus(c.allowedTransitions[0]);
                      setStatusOpen(true);
                    }}
                  >
                    Update status
                  </Button>
                )}
                <Button variant="secondary" icon={GitMerge} loading={busy === 'rescan'} onClick={rescan}>
                  Re-scan overlaps
                </Button>
              </div>
            )}
          </Card>

          <ClosureGuard
            caseData={c}
            onChange={(updated) => {
              setData((d) => ({ ...d, case: updated }));
              load();
            }}
          />

          {data.ledger?.length > 0 && (
            <Card className="p-5 sm:p-6" data-tour="case-ledger">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-bold text-ink">Promise ledger</h2>
                  <p className="text-xs text-ink-muted">What the institution promised in writing, and whether the complainant confirmed it</p>
                </div>
                <Link to="/promises" className="link text-xs">
                  All promises
                </Link>
              </div>
              <ul className="space-y-3">
                {data.ledger.map((e) => (
                  <PromiseRow key={e._id} entry={e} showCase={false} demo={Boolean(meta?.demo?.controls)} onChanged={load} />
                ))}
              </ul>
            </Card>
          )}

          <section data-tour="case-overlaps">
            <h2 className="mb-3 flex items-center gap-2 font-bold text-ink">
              <GitMerge className="h-5 w-5 text-ember-600" /> Related & duplicate cases
              <span className="rounded-full bg-paper-deep px-2 text-xs">{data.overlaps.length}</span>
            </h2>
            {data.overlaps.length === 0 ? (
              <p className="card p-5 text-sm text-ink-muted">No overlaps detected for this case.</p>
            ) : (
              <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
                {data.overlaps.map((o) => (
                  <EvidenceCard key={o.id} overlap={o} onDecided={load} />
                ))}
              </motion.div>
            )}
          </section>

          <Card className="p-5 sm:p-6" data-tour="case-history">
            <h2 className="mb-4 font-bold text-ink">Case history</h2>
            {c.canEdit && (
              <form onSubmit={addNote} className="mb-6 flex flex-col gap-2 sm:flex-row">
                <input className="input" placeholder="Add a note to the case record…" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} />
                <Button type="submit" variant="secondary" icon={MessageSquarePlus} loading={busy === 'note'} className="shrink-0">
                  Add note
                </Button>
              </form>
            )}
            <Timeline events={history} />
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="space-y-4 p-5">
            <h2 className="font-bold text-ink">Details</h2>
            <Info icon={Building2} label="Institution">
              <Link to={`/institutions/${c.institution.permanentId}`} className="link">
                {c.institution.name}
              </Link>
              <p className="font-mono text-xs text-ink-muted">{c.institution.permanentId}</p>
            </Info>
            <Info icon={GitMerge} label="Category · Channel">
              {categoryLabel(c.category)} · {channelLabel(c.channel)}
            </Info>
            <Info icon={UserCheck} label="Assigned to">
              {c.assignedToName || '—'} <span className="text-ink-muted">({bureauName(c.bureau)})</span>
            </Info>
            <Info icon={CalendarClock} label="Registered · Deadline">
              {formatDate(c.createdAt)} · {formatDate(c.dueDate)}
            </Info>
          </Card>

          <Card className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-ink">Complainant</h2>
              {c.complainant.masked && (
                <span className="chip bg-paper-deep text-ink-muted">
                  <Lock className="h-3 w-3" /> Masked
                </span>
              )}
            </div>
            <Info icon={User} label="Name">{c.complainant.name || '—'}</Info>
            {c.complainant.masked ? (
              <p className="rounded-xl bg-paper-soft p-3 text-xs text-ink-muted">Contact details are visible only to {bureauName(c.bureau)} officers and senior reviewers.</p>
            ) : (
              <>
                <Info icon={Mail} label="Email">{c.complainant.email || '—'}</Info>
                <Info icon={Phone} label="Phone">{c.complainant.phone || '—'}</Info>
              </>
            )}
          </Card>
        </div>
      </motion.div>

      <Modal
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        title="Update case status"
        footer={
          <>
            <Button variant="secondary" onClick={() => setStatusOpen(false)}>Cancel</Button>
            <Button loading={busy === 'status'} onClick={changeStatus}>Save change</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="New status">
            <div className="grid gap-2 sm:grid-cols-2">
              {c.allowedTransitions.map((s) => (
                <button key={s} type="button" onClick={() => setNextStatus(s)} className={clsx('rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition', nextStatus === s ? 'border-ember-400 bg-ember-50 text-ember-800 shadow-glow' : 'border-paper-line text-ink-soft hover:border-ember-200')}>
                  {statusLabel(s)}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Note (required)" error={formError}>
            <textarea className="input min-h-[100px]" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed and why?" />
          </Field>
        </div>
      </Modal>
    </Page>
  );
}
