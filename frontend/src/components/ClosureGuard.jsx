import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import {
  AlertTriangle,
  ArrowDownRight,
  CheckCircle2,
  ChevronDown,
  FileCheck2,
  FlaskConical,
  Copy,
  HandCoins,
  Paperclip,
  Plus,
  RefreshCcw,
  Scale,
  ShieldCheck,
  Trash2,
  Undo2,
  XCircle,
} from 'lucide-react';
import { api, errorMessage, fieldErrors } from '../lib/api.js';
import { formatDateTime } from '../lib/format.js';
import { useToast } from './Toast.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, Card, Field, Modal } from './ui.jsx';
import { money } from './promises.jsx';

const STATUS = {
  addressed: { label: 'Addressed', icon: CheckCircle2, text: 'text-sage-700', chip: 'bg-sage-50 text-sage-700', mark: 'bg-sage-100/80 decoration-sage-500' },
  partial: { label: 'Partially addressed', icon: AlertTriangle, text: 'text-honey-700', chip: 'bg-honey-50 text-honey-700', mark: 'bg-honey-100/80 decoration-honey-500' },
  not_addressed: { label: 'Not addressed', icon: XCircle, text: 'text-rosewood-700', chip: 'bg-rosewood-50 text-rosewood-700', mark: 'bg-rosewood-100/80 decoration-rosewood-500' },
};

const SOURCES = [
  ['institution_letter', 'Institution letter'],
  ['portal', 'Portal reply'],
  ['email', 'Email'],
  ['hearing', 'Hearing record'],
];

const EVIDENCE_TYPES = [
  ['payment_proof', 'Payment proof (UTR / bank statement)'],
  ['acknowledgement', 'Signed acknowledgement'],
  ['committee_report', 'Committee action report'],
  ['inspection_report', 'Inspection report'],
  ['official_letter', 'Official letter / order'],
  ['photographs', 'Photographs'],
  ['other', 'Other'],
];
const evidenceLabel = (t) => EVIDENCE_TYPES.find(([k]) => k === t)?.[1] || t;

// Development-only sample responses for the Sunrise fee-refund demo.
const DEMOS = {
  partial: {
    source: 'institution_letter',
    text: 'The institute has processed a refund of Rs 40,000 to the student. The remaining amount will be refunded after the audit of accounts is completed.',
    evidence: [],
  },
  promise: {
    source: 'institution_letter',
    text: 'The refund of Rs 85,000 will be processed within 30 days after approval of the management.',
    evidence: [],
  },
  complete: {
    source: 'institution_letter',
    text: 'The full tuition fee of Rs 85,000 has been refunded to the student by NEFT, UTR 2026101500123. The accounts office has issued a written reply to the student apologising for the delay.',
    evidence: [{ type: 'payment_proof', reference: 'NEFT UTR 2026101500123 dated 20 Oct 2026' }],
  },
};

/** Renders text with highlighted [start, end) spans. Spans must not overlap. */
function Highlighted({ text, spans, lang }) {
  const parts = useMemo(() => {
    const valid = spans.filter((s) => s.start != null && s.end > s.start).sort((a, b) => a.start - b.start);
    const out = [];
    let pos = 0;
    for (const s of valid) {
      if (s.start < pos) continue;
      if (s.start > pos) out.push({ text: text.slice(pos, s.start) });
      out.push({ text: text.slice(s.start, s.end), span: s });
      pos = s.end;
    }
    if (pos < text.length) out.push({ text: text.slice(pos) });
    return out;
  }, [text, spans]);

  return (
    <p className={clsx('whitespace-pre-line text-sm leading-7 text-ink-soft', lang && 'font-hi')}>
      {parts.map((p, i) =>
        p.span ? (
          <mark key={i} className={clsx('rounded px-0.5 text-ink underline decoration-2 underline-offset-4', p.span.cls)} title={p.span.title}>
            {p.text}
            <sup className="ml-0.5 text-[0.65rem] font-bold text-ink-muted">{p.span.tag}</sup>
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </p>
  );
}

function ScoreRing({ addressed, total }) {
  const pct = total ? addressed / total : 0;
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#F7E9DA" strokeWidth="7" />
        <motion.circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={pct === 1 ? '#3F8F5B' : '#F26C1F'}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-none">
        <span className="text-base font-extrabold text-ink">
          {addressed}/{total}
        </span>
      </div>
    </div>
  );
}

export function ResponseForm({ open, onClose, endpoint, onSaved, portal = false }) {
  const toast = useToast();
  const { meta } = useAuth();
  const [form, setForm] = useState({ source: 'institution_letter', text: '', evidence: [] });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const setEv = (i, k, v) => setForm((f) => ({ ...f, evidence: f.evidence.map((e, j) => (j === i ? { ...e, [k]: v } : e)) }));

  const submit = async () => {
    setSaving(true);
    setErrors({});
    try {
      const { data } = await api.post(endpoint, form);
      toast(portal ? 'Response submitted to AICTE' : 'Response recorded — ClosureGuard review ready');
      setForm({ source: 'institution_letter', text: '', evidence: [] });
      onSaved(data.case);
      onClose();
    } catch (err) {
      setErrors(fieldErrors(err));
      if (!Object.keys(fieldErrors(err)).length) toast(errorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={portal ? 'Respond to this complaint' : 'Record institution response'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button icon={ShieldCheck} loading={saving} onClick={submit}>
            {portal ? 'Submit response' : saving ? 'Reviewing…' : 'Save & run ClosureGuard'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {portal && (
          <p className="rounded-xl bg-paper-soft p-3 text-sm text-ink-muted">
            Describe the action taken on every point in the complaint and attach evidence references (for example a UTR number or a signed acknowledgement). An AICTE officer reviews your response before the complaint is closed.
          </p>
        )}
        {meta?.demo && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" icon={FlaskConical} onClick={() => setForm(structuredClone(DEMOS.partial))}>
              Demo: partial reply
            </Button>
            <Button size="sm" variant="secondary" icon={FlaskConical} onClick={() => setForm(structuredClone(DEMOS.promise))}>
              Demo: promise reply
            </Button>
            <Button size="sm" variant="secondary" icon={FlaskConical} onClick={() => setForm(structuredClone(DEMOS.complete))}>
              Demo: complete reply
            </Button>
          </div>
        )}
        {!portal && (
        <Field label="Received via" error={errors.source}>
          <select className="input" value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}>
            {SOURCES.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        )}
        <Field label={portal ? 'Action taken' : "Institution's response / action taken"} error={errors.text}>
          <textarea className="input min-h-[140px]" value={form.text} onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))} placeholder={portal ? 'Describe what the institution has done on each point, with dates and reference numbers.' : "Paste the institution's reply exactly as received."} />
        </Field>
        <div>
          <span className="label">Supporting evidence</span>
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {form.evidence.map((e, i) => (
                <motion.div key={i} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <select className="input" value={e.type} onChange={(ev) => setEv(i, 'type', ev.target.value)} aria-label="Evidence type">
                    {EVIDENCE_TYPES.map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </select>
                  <input className="input" value={e.reference} onChange={(ev) => setEv(i, 'reference', ev.target.value)} placeholder="Reference, e.g. UTR / letter no." aria-label="Evidence reference" />
                  <button type="button" onClick={() => setForm((f) => ({ ...f, evidence: f.evidence.filter((_, j) => j !== i) }))} className="grid h-10 w-10 place-items-center rounded-xl text-ink-muted hover:bg-rosewood-50 hover:text-rosewood-700" aria-label="Remove evidence">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
            <Button size="sm" variant="ghost" icon={Plus} onClick={() => setForm((f) => ({ ...f, evidence: [...f.evidence, { type: 'payment_proof', reference: '' }] }))}>
              Add evidence
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function ConcernRow({ concern, index, override, onOverride, editable }) {
  const effective = override || concern.status;
  const S = STATUS[effective];
  return (
    <motion.li initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + index * 0.08 }} className="rounded-2xl border border-paper-line bg-white p-4">
      <div className="flex flex-wrap items-start gap-3">
        <S.icon className={clsx('mt-0.5 h-5 w-5 shrink-0', S.text)} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-ink-faint">{concern.id.toUpperCase()}</span>
            <span className="font-semibold text-ink">{concern.label}</span>
            <span className={clsx('chip', S.chip)}>{S.label}</span>
            {override && (
              <span className="chip bg-ink text-white" title={`ClosureGuard said: ${STATUS[concern.status].label}`}>
                Officer override
              </span>
            )}
          </div>
          <blockquote className="mt-2 border-l-2 border-ember-200 pl-3 text-sm italic text-ink-soft">“{concern.text}”</blockquote>
          {concern.responseSpan?.text && (
            <div className="mt-2 flex gap-2 text-sm">
              <ArrowDownRight className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
              <p className="text-ink-soft">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Response: </span>“{concern.responseSpan.text}”
              </p>
            </div>
          )}
          <p className={clsx('mt-2 text-sm font-medium', STATUS[concern.status].text)}>{concern.reason}</p>
          {concern.expectedEvidence && (
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
              <Paperclip className="h-3.5 w-3.5 text-ink-faint" />
              <span className="text-ink-muted">Expected evidence:</span>
              <span className={clsx('chip', concern.evidenceFound?.length ? 'bg-sage-50 text-sage-700' : 'bg-rosewood-50 text-rosewood-700')}>
                {concern.expectedEvidence} {concern.evidenceFound?.length ? '· provided' : '· missing'}
              </span>
            </p>
          )}
        </div>
        {editable && (
          <select
            className="input w-full py-1.5 text-xs sm:w-52"
            value={override || ''}
            onChange={(e) => onOverride(concern.id, e.target.value)}
            aria-label={`Officer assessment for ${concern.id}`}
          >
            <option value="">Agree with review</option>
            {Object.entries(STATUS)
              .filter(([k]) => k !== concern.status)
              .map(([k, v]) => (
                <option key={k} value={k}>
                  Mark {v.label.toLowerCase()}
                </option>
              ))}
          </select>
        )}
      </div>
    </motion.li>
  );
}

function ReviewPanel({ caseData, response, latest, onChange }) {
  const toast = useToast();
  const review = response.review || {};
  const decided = response.decision?.outcome;
  const editable = latest && !decided && caseData.canEdit && caseData.isOpen;
  const [overrides, setOverrides] = useState({});
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const promises = review.promises || [];
  const defaultDate = (p) => (p.deadline ? new Date(p.deadline) : new Date(Date.now() + 30 * 86_400_000)).toISOString().slice(0, 10);
  const [picks, setPicks] = useState(() => Object.fromEntries(promises.map((p) => [p.id, { on: true, date: defaultDate(p) }])));
  const chosen = promises.filter((p) => picks[p.id]?.on);

  const concerns = review.concerns || [];
  const decidedOverrides = Object.fromEntries((response.decision?.overrides || []).map((o) => [o.concernId, o.status]));
  const activeOverrides = decided ? decidedOverrides : overrides;
  const effective = (c) => activeOverrides[c.id] || c.status;
  const addressed = concerns.filter((c) => effective(c) === 'addressed').length;
  const openItems = concerns.length - addressed + (review.inconsistencies?.length || 0);

  const statusOrder = { not_addressed: 0, partial: 1, addressed: 2 };
  const sorted = [...concerns].sort((a, b) => statusOrder[effective(a)] - statusOrder[effective(b)]);

  const complaintSpans = concerns.map((c) => ({ start: c.start, end: c.end, cls: STATUS[effective(c)].mark, tag: c.id.toUpperCase(), title: c.label }));
  const responseSpans = concerns
    .filter((c) => c.responseSpan)
    .map((c) => {
      const start = response.text.indexOf(c.responseSpan.text);
      return { start, end: start + c.responseSpan.text.length, cls: 'bg-ember-50 decoration-ember-400', tag: c.id.toUpperCase(), title: `Matched to ${c.id}` };
    })
    .filter((s, i, arr) => s.start >= 0 && arr.findIndex((x) => x.start === s.start) === i)
    .map((s) => ({ ...s, tag: concerns.filter((c) => c.responseSpan && response.text.indexOf(c.responseSpan.text) === s.start).map((c) => c.id.toUpperCase()).join(',') }));

  const decide = async (outcome) => {
    setBusy(outcome);
    setError('');
    try {
      const { data } = await api.post(`/cases/${caseData.id}/responses/${response._id}/decision`, {
        outcome,
        reason,
        promises: outcome === 'accept_on_promise' ? chosen.map((p) => ({ id: p.id, dueDate: `${picks[p.id].date}T23:59:59` })) : undefined,
        overrides: Object.entries(overrides)
          .filter(([, s]) => s)
          .map(([concernId, status]) => ({ concernId, status })),
      });
      toast(
        {
          accept: 'Resolution accepted — case resolved',
          accept_on_promise: `Resolved on promise — ${chosen.length} promise${chosen.length > 1 ? 's' : ''} added to the ledger`,
          request_more: 'Further action requested from the institution',
        }[outcome],
      );
      onChange(data.case);
    } catch (err) {
      setError(fieldErrors(err).reason || errorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const rerun = async () => {
    setBusy('rerun');
    try {
      const { data } = await api.post(`/cases/${caseData.id}/responses/${response._id}/review`);
      onChange(data.case);
      toast('ClosureGuard review updated');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-ember-50 via-white to-white p-4 sm:flex-row sm:items-center">
        {concerns.length > 0 && <ScoreRing addressed={addressed} total={concerns.length} />}
        <div className="min-w-0 flex-1">
          <p className="font-bold text-ink">
            {review.error
              ? 'Review unavailable'
              : openItems === 0
                ? 'No gaps found — every concern appears addressed'
                : `${openItems} item${openItems > 1 ? 's' : ''} need${openItems > 1 ? '' : 's'} attention before closure`}
          </p>
          <p className="text-xs text-ink-muted">
            Response via {SOURCES.find(([k]) => k === response.source)?.[1]} · recorded by {response.recordedByName} · {formatDateTime(response.at)}
            {review.mode && ` · ${review.mode} engine`}
          </p>
        </div>
        {editable && (
          <Button size="sm" variant="secondary" icon={RefreshCcw} loading={busy === 'rerun'} onClick={rerun}>
            Re-run review
          </Button>
        )}
      </div>

      {review.error && <p className="rounded-xl bg-honey-50 px-3.5 py-2.5 text-sm text-honey-700">{review.error}</p>}

      {/* Side-by-side texts */}
      {concerns.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-paper-line bg-paper/60 p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">Original complaint</p>
            <Highlighted text={caseData.description} spans={complaintSpans} lang={caseData.language !== 'en'} />
          </div>
          <div className="rounded-2xl border border-paper-line bg-paper/60 p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">Institution response</p>
            <Highlighted text={response.text} spans={responseSpans} />
            {response.evidence?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {response.evidence.map((e, i) => (
                  <span key={i} className="chip bg-white text-ink-soft ring-1 ring-inset ring-paper-line">
                    <Paperclip className="h-3 w-3" /> {evidenceLabel(e.type)}
                    {e.reference && `: ${e.reference}`}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checklist */}
      {concerns.length > 0 && (
        <ul className="space-y-3">
          {sorted.map((c, i) => (
            <ConcernRow key={c.id} concern={c} index={i} override={activeOverrides[c.id]} editable={editable} onOverride={(id, s) => setOverrides((o) => ({ ...o, [id]: s }))} />
          ))}
        </ul>
      )}

      {review.inconsistencies?.length > 0 && (
        <div className="rounded-2xl border border-rosewood-100 bg-rosewood-50/60 p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold text-rosewood-700">
            <Scale className="h-4 w-4" /> Inconsistencies
          </p>
          <ul className="space-y-1 text-sm text-ink-soft">
            {review.inconsistencies.map((x, i) => (
              <li key={i}>• {x.detail}</li>
            ))}
          </ul>
        </div>
      )}

      {response.template?.others > 0 && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 rounded-2xl border border-honey-100 bg-honey-50/70 p-4 text-sm">
          <Copy className="mt-0.5 h-5 w-5 shrink-0 text-honey-700" />
          <div>
            <p className="font-bold text-ink">Template reply</p>
            <p className="mt-0.5 text-ink-soft">
              Almost the same text was sent to <b>{response.template.others} other complainant{response.template.others > 1 ? 's' : ''}</b> of this institution across {response.template.bureaus.join(', ')} ({response.template.caseRefs.join(', ')}). The same promise to many people is often a stalling tactic, not a resolution.
            </p>
          </div>
        </motion.div>
      )}

      {promises.length > 0 && (
        <div className="rounded-2xl border border-ember-100 bg-white p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-ink">
            <HandCoins className="h-4 w-4 text-ember-600" /> Promises in this reply
            <span className="chip bg-ember-50 text-ember-700">{promises.length}</span>
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            If you resolve on promise, each ticked promise goes into the Promise Ledger. On its date the complainant is asked whether it was kept; a “No” reopens the case.
          </p>
          <ul className="mt-3 space-y-2.5">
            {promises.map((p) => (
              <li key={p.id} className={clsx('rounded-xl border p-3 transition', picks[p.id]?.on ? 'border-ember-200 bg-ember-50/40' : 'border-paper-line opacity-70')}>
                <div className="flex flex-wrap items-center gap-2">
                  {editable && (
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-ember-600"
                      checked={Boolean(picks[p.id]?.on)}
                      onChange={(e) => setPicks((x) => ({ ...x, [p.id]: { ...x[p.id], on: e.target.checked } }))}
                      aria-label={`Track promise: ${p.action}`}
                    />
                  )}
                  <span className="font-semibold text-ink">{p.action}</span>
                  {money(p.amount) && <span className="chip bg-white text-ink-soft ring-1 ring-inset ring-paper-line">{money(p.amount)}</span>}
                  {p.kind === 'stall' && <span className="chip bg-rosewood-50 text-rosewood-700">No concrete action</span>}
                  {p.vague && <span className="chip bg-honey-50 text-honey-700">No deadline given</span>}
                  {p.condition && <span className="chip bg-paper-deep text-ink-soft">Condition: {p.condition}</span>}
                </div>
                <blockquote className="mt-1.5 text-sm italic text-ink-soft">“{p.text}”</blockquote>
                {editable && picks[p.id]?.on && (
                  <label className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                    Check with the complainant on
                    <input
                      type="date"
                      className="input w-auto py-1 text-xs"
                      value={picks[p.id].date}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setPicks((x) => ({ ...x, [p.id]: { ...x[p.id], date: e.target.value } }))}
                    />
                    {p.deadlineText ? <span>(institution said “{p.deadlineText}”)</span> : <span>(no date given — default 30 days)</span>}
                  </label>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Decision */}
      {decided ? (
        <div className={clsx('flex flex-col gap-1 rounded-2xl p-4 text-sm', { accept: 'bg-sage-50 text-sage-700', accept_on_promise: 'bg-ember-50 text-ember-800', request_more: 'bg-teal-50 text-teal-700' }[decided])}>
          <p className="flex items-center gap-2 font-bold">
            {{ accept: <FileCheck2 className="h-4 w-4" />, accept_on_promise: <HandCoins className="h-4 w-4" />, request_more: <Undo2 className="h-4 w-4" /> }[decided]}
            {{ accept: 'Resolution accepted', accept_on_promise: 'Resolved on promise — tracked in the Promise Ledger', request_more: 'Further action requested' }[decided]}
            {response.decision.openConcerns > 0 && decided === 'accept' && <span className="chip bg-honey-50 text-honey-700">accepted with {response.decision.openConcerns} open item{response.decision.openConcerns > 1 ? 's' : ''}</span>}
          </p>
          <p className="text-ink-soft">
            {response.decision.byName} · {formatDateTime(response.decision.at)} — “{response.decision.reason}”
          </p>
        </div>
      ) : (
        editable && (
          <div className="rounded-2xl border border-ember-100 bg-ember-50/50 p-4">
            <p className="mb-3 flex items-start gap-2 text-sm text-ink-soft">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ember-600" />
              ClosureGuard only recommends. You decide, and your decision, reason and any overrides are recorded on the case and in the audit trail.
            </p>
            <Field label="Decision reason" error={error} hint={openItems > 0 ? `Accepting with ${openItems} open item${openItems > 1 ? 's' : ''} needs at least 30 characters of justification.` : undefined}>
              <textarea className="input min-h-[90px]" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={openItems > 0 ? 'e.g. Remaining Rs 45,000 and payment proof required before closure.' : 'e.g. Full refund confirmed with UTR; written reply sent to the complainant.'} />
            </Field>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="teal" icon={Undo2} loading={busy === 'request_more'} onClick={() => decide('request_more')}>
                Request more from institution
              </Button>
              {promises.length > 0 && (
                <Button variant="secondary" icon={HandCoins} loading={busy === 'accept_on_promise'} disabled={!chosen.length} onClick={() => decide('accept_on_promise')} className="border-ember-300 text-ember-800">
                  Resolve on promise ({chosen.length})
                </Button>
              )}
              <Button icon={FileCheck2} loading={busy === 'accept'} onClick={() => decide('accept')}>
                Accept & resolve
              </Button>
            </div>
          </div>
        )
      )}
    </div>
  );
}

export default function ClosureGuard({ caseData, onChange }) {
  const [formOpen, setFormOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const responses = caseData.responses || [];
  const latest = responses.at(-1);
  const earlier = responses.slice(0, -1).reverse();
  const canRecord = caseData.canEdit && caseData.isOpen && (!latest || latest.decision?.outcome);

  return (
    <Card className="overflow-hidden" data-tour="closureguard">
      <div className="flex flex-col gap-3 border-b border-paper-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-ember-400 to-ember-600 text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold text-ink">ClosureGuard</h2>
            <p className="text-xs text-ink-muted">Checks whether the institution’s response answers every concern before closure</p>
          </div>
        </div>
        {canRecord && (
          <Button icon={Plus} onClick={() => setFormOpen(true)}>
            {latest ? 'Record new response' : 'Record institution response'}
          </Button>
        )}
      </div>

      <div className="p-5 sm:p-6">
        {!latest ? (
          <div className="flex flex-col items-center py-6 text-center">
            <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 3 }} className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-ember-100 text-ember-600">
              <ShieldCheck className="h-6 w-6" />
            </motion.div>
            <p className="font-semibold text-ink">No institution response yet</p>
            <p className="mt-1 max-w-md text-sm text-ink-muted">
              When the institution replies, record it here. ClosureGuard will break the complaint into concerns, check each against the response and flag missing evidence. A case can only be resolved through this review.
            </p>
          </div>
        ) : (
          <ReviewPanel key={latest._id} caseData={caseData} response={latest} latest onChange={onChange} />
        )}

        {earlier.length > 0 && (
          <div className="mt-6 border-t border-paper-line pt-4">
            <button onClick={() => setShowHistory((s) => !s)} className="flex items-center gap-2 text-sm font-semibold text-ink-soft hover:text-ember-700">
              <ChevronDown className={clsx('h-4 w-4 transition', showHistory && 'rotate-180')} />
              Earlier responses ({earlier.length})
            </button>
            <AnimatePresence>
              {showHistory && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="mt-4 space-y-8">
                    {earlier.map((r) => (
                      <ReviewPanel key={r._id} caseData={caseData} response={r} latest={false} onChange={onChange} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <ResponseForm open={formOpen} onClose={() => setFormOpen(false)} endpoint={`/cases/${caseData.id}/responses`} onSaved={onChange} />
    </Card>
  );
}
