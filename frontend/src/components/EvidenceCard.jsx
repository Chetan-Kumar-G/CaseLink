import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { ArrowLeftRight, Ban, BrainCircuit, Fingerprint, Handshake, Link2, ListChecks, Lock, ShieldQuestion } from 'lucide-react';
import { api, errorMessage } from '../lib/api.js';
import { formatDate, formatDateTime } from '../lib/format.js';
import { useMeta } from '../context/AuthContext.jsx';
import { useToast } from './Toast.jsx';
import { BureauBadge, CrossBureauBadge, StatusBadge } from './badges.jsx';
import { Button, Field, Modal, fadeUp } from './ui.jsx';

const LAYER = {
  exact: { label: 'Exact match', icon: Fingerprint, cls: 'bg-rosewood-50 text-rosewood-700 ring-rosewood-100' },
  rule: { label: 'Rule match', icon: ListChecks, cls: 'bg-honey-50 text-honey-700 ring-honey-100' },
  semantic: { label: 'Semantic match', icon: BrainCircuit, cls: 'bg-teal-50 text-teal-700 ring-teal-100' },
};

const DECISION = {
  linked: { label: 'Linked', cls: 'bg-sage-50 text-sage-700', icon: Link2 },
  dismissed: { label: 'Dismissed', cls: 'bg-paper-deep text-ink-muted', icon: Ban },
  coordination_requested: { label: 'Coordination requested', cls: 'bg-teal-50 text-teal-700', icon: Handshake },
};

const ACTIONS = {
  link: { title: 'Link these cases', verb: 'Link cases', placeholder: 'e.g. Same refund issue raised with both bureaus; PGRC will lead and RB will be kept informed.' },
  coordinate: { title: 'Request coordination', verb: 'Send request', placeholder: 'e.g. RB proceeding covers the same fee practice; requesting a joint review before replying to the complainant.' },
  dismiss: { title: 'Dismiss this overlap', verb: 'Dismiss', placeholder: 'e.g. Different programmes and different issues; similarity is superficial.' },
};

function CaseMini({ c }) {
  const { categoryLabel } = useMeta();
  if (!c) return <div className="rounded-xl bg-paper-soft p-3 text-sm text-ink-muted">Case unavailable</div>;
  return (
    <Link to={`/cases/${c.id}`} className="group block min-w-0 rounded-2xl border border-paper-line bg-paper/60 p-3.5 transition hover:border-ember-200 hover:bg-white">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <BureauBadge code={c.bureau} />
        <span className="font-mono text-xs font-medium text-ink-muted">{c.caseRef}</span>
      </div>
      <p className={clsx('line-clamp-2 text-sm font-semibold text-ink group-hover:text-ember-800', c.language !== 'en' && 'font-hi')} lang={c.language === 'hi' ? 'hi' : undefined}>
        {c.subject}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
        <StatusBadge status={c.status} />
        <span>{categoryLabel(c.category)}</span>
        <span>· {formatDate(c.createdAt)}</span>
        {c.access === 'masked' && (
          <span className="inline-flex items-center gap-1 text-ink-faint" title="Complainant identity is masked outside the owning bureau">
            <Lock className="h-3 w-3" /> masked
          </span>
        )}
      </div>
    </Link>
  );
}

export default function EvidenceCard({ overlap, onDecided, showInstitution }) {
  const toast = useToast();
  const [action, setAction] = useState(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const ev = overlap.evidence || {};
  const pct = Math.round((overlap.score || 0) * 100);
  const decided = DECISION[overlap.status];

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      const { data } = await api.post(`/overlaps/${overlap.id}/decision`, { action, reason });
      toast(action === 'dismiss' ? 'Overlap dismissed and recorded' : action === 'link' ? 'Cases linked — both case histories updated' : 'Coordination request sent to the other bureau');
      setAction(null);
      setReason('');
      onDecided?.(data.overlap);
    } catch (err) {
      setError(err.response?.data?.fields?.reason || errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.article variants={fadeUp} layout className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-paper-line bg-gradient-to-r from-ember-50/80 to-transparent px-4 py-3 sm:px-5">
        <span className={clsx('chip', overlap.kind === 'duplicate' ? 'bg-rosewood-500 text-white' : 'bg-ink text-white')}>
          {overlap.kind === 'duplicate' ? 'Probable duplicate' : 'Related case'}
        </span>
        {overlap.crossBureau && <CrossBureauBadge />}
        {ev.layers?.map((l) => {
          const L = LAYER[l];
          return (
            <span key={l} className={clsx('chip ring-1 ring-inset', L.cls)}>
              <L.icon className="h-3.5 w-3.5" /> {L.label}
            </span>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-paper-deep">
            <motion.div className="h-full rounded-full bg-ember-500" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} />
          </div>
          <span className="text-xs font-bold tabular-nums text-ink">{pct}%</span>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {showInstitution && overlap.institution && (
          <Link to={`/institutions/${overlap.institution.permanentId}`} className="link text-sm">
            {overlap.institution.name} <span className="font-mono text-xs text-ink-muted">({overlap.institution.permanentId})</span>
          </Link>
        )}

        <div className="grid items-center gap-2 md:grid-cols-[1fr_auto_1fr]">
          <CaseMini c={overlap.caseA} />
          <div className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-ember-100 text-ember-700 md:rotate-0">
            <ArrowLeftRight className="h-4 w-4 rotate-90 md:rotate-0" />
          </div>
          <CaseMini c={overlap.caseB} />
        </div>

        <div className="rounded-2xl bg-paper-soft/80 p-3.5">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-muted">
            <ShieldQuestion className="h-3.5 w-3.5" /> Why these were linked
          </p>
          <p className="text-sm text-ink-soft">{ev.explanation}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {ev.matchedFields?.map((f) => (
              <span key={f.field} className="chip bg-white text-ink-soft ring-1 ring-inset ring-paper-line">
                {f.label}: <span className="font-semibold text-ink">{f.value}</span>
              </span>
            ))}
          </div>
          {ev.sharedTerms?.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-ink-muted">Shared concepts:</span>
              {ev.sharedTerms.slice(0, 8).map((t) => (
                <span key={t} className="chip bg-ember-100/70 text-ember-800">
                  {t}
                </span>
              ))}
            </div>
          )}
          {ev.similarity != null && (
            <p className="mt-2 text-xs text-ink-faint">
              Text similarity {Math.round(ev.similarity * 100)}% · {ev.semanticMode} engine · filed {ev.daysApart} days apart
            </p>
          )}
        </div>

        {decided ? (
          <div className={clsx('flex flex-col gap-1 rounded-2xl px-3.5 py-3 text-sm sm:flex-row sm:items-center sm:gap-3', decided.cls)}>
            <span className="flex items-center gap-1.5 font-bold">
              <decided.icon className="h-4 w-4" /> {decided.label}
            </span>
            <span className="text-ink-soft">
              by {overlap.decision?.byName} · {formatDateTime(overlap.decision?.at)} — “{overlap.decision?.reason}”
            </span>
          </div>
        ) : overlap.canDecide ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button icon={Link2} onClick={() => setAction('link')}>Link cases</Button>
            {overlap.crossBureau && (
              <Button variant="teal" icon={Handshake} onClick={() => setAction('coordinate')}>
                Request coordination
              </Button>
            )}
            <Button variant="secondary" icon={Ban} onClick={() => setAction('dismiss')}>Dismiss</Button>
          </div>
        ) : (
          <p className="text-xs text-ink-faint">Awaiting a decision from an officer of the bureaus involved.</p>
        )}
      </div>

      <Modal
        open={Boolean(action)}
        onClose={() => setAction(null)}
        title={action ? ACTIONS[action].title : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAction(null)}>Cancel</Button>
            <Button variant={action === 'dismiss' ? 'danger' : action === 'coordinate' ? 'teal' : 'primary'} loading={saving} onClick={submit}>
              {action && ACTIONS[action].verb}
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-ink-muted">
          Your decision and reason are recorded on both cases and in the audit trail. Cases are never merged automatically.
        </p>
        <Field label="Reason" error={error}>
          <textarea className="input min-h-[110px]" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={action ? ACTIONS[action].placeholder : ''} autoFocus />
        </Field>
      </Modal>
    </motion.article>
  );
}
