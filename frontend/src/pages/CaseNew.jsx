import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { ArrowRight, Building2, CheckCircle2, FlaskConical, GitMerge, Languages, Loader2, Send, ShieldCheck } from 'lucide-react';
import { api, errorMessage, fieldErrors } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import EvidenceCard from '../components/EvidenceCard.jsx';
import { Button, Card, Field, Page, PageHeader, stagger } from '../components/ui.jsx';

const EMPTY = {
  permanentId: '',
  bureau: '',
  channel: 'portal',
  category: 'fee_refund',
  priority: 'medium',
  subject: '',
  description: '',
  complainant: { name: '', email: '', phone: '' },
};

// Demo scenario from the proposal: a Hindi fee-refund complaint about Sunrise
// Institute, filed while PGRC and RB already have related cases open.
const DEMO = {
  permanentId: '1-2468013579',
  channel: 'cpgrams',
  category: 'fee_refund',
  priority: 'high',
  subject: 'प्रवेश वापस लेने के बाद फीस वापसी नहीं',
  description:
    'मैंने अगस्त में बी.टेक में प्रवेश वापस ले लिया था और सभी दस्तावेज़ जमा कर दिए थे। तीन महीने हो गए लेकिन संस्थान ने मेरी ट्यूशन फीस वापस नहीं की है और लेखा विभाग कोई जवाब नहीं देता।',
  complainant: { name: 'Priya Kumari', email: 'priya.k@example.com', phone: '' },
};

function detectLang(text) {
  const hi = (text.match(/[ऀ-ॿ]/g) || []).length;
  const en = (text.match(/[A-Za-z]/g) || []).length;
  if (!hi && !en) return null;
  const r = hi / (hi + en);
  return r > 0.8 ? 'Hindi' : r > 0.15 ? 'Mixed' : 'English';
}

export default function CaseNew() {
  const { user, meta } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ ...EMPTY, bureau: user.bureau || '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [inst, setInst] = useState({ state: 'idle' });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setC = (k, v) => setForm((f) => ({ ...f, complainant: { ...f.complainant, [k]: v } }));
  const lang = useMemo(() => detectLang(`${form.subject} ${form.description}`), [form.subject, form.description]);

  // Live institution lookup as the Permanent ID is typed.
  useEffect(() => {
    const id = form.permanentId.trim();
    if (!/^1-\d{5,12}$/.test(id)) {
      setInst({ state: id ? 'invalid' : 'idle' });
      return undefined;
    }
    setInst({ state: 'loading' });
    const t = setTimeout(() => {
      api
        .get('/institutions', { params: { q: id } })
        .then((r) => {
          const found = r.data.institutions.find((i) => i.permanentId === id);
          setInst(found ? { state: 'found', data: found } : { state: 'missing' });
        })
        .catch(() => setInst({ state: 'missing' }));
    }, 300);
    return () => clearTimeout(t);
  }, [form.permanentId]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const body = { ...form, bureau: user.role === 'admin' ? form.bureau : undefined };
      const { data } = await api.post('/cases', body);
      setResult(data);
      toast(`Registered ${data.case.caseRef}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setErrors(fieldErrors(err));
      toast(errorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    const cross = result.overlaps.filter((o) => o.crossBureau).length;
    return (
      <Page>
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="card mb-6 overflow-hidden">
          <div className="flex flex-col gap-4 bg-gradient-to-r from-sage-50 to-white p-5 sm:flex-row sm:items-center sm:p-6">
            <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.1 }} className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-sage-500 text-white">
              <CheckCircle2 className="h-7 w-7" />
            </motion.div>
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-sage-700">Case registered</p>
              <h1 className="text-2xl font-extrabold tracking-tight text-ink">{result.case.caseRef}</h1>
              <p className="mt-1 text-sm text-ink-muted">
                Overlap check complete —{' '}
                <b className="text-ink">
                  {result.overlaps.length} potential overlap{result.overlaps.length === 1 ? '' : 's'}
                </b>
                {cross > 0 && <span> ({cross} cross-bureau)</span>}.{' '}
                {result.semantic?.ran ? `Semantic layer: ${result.semantic.mode}.` : 'Semantic layer was unavailable; exact and rule layers ran. Re-scan later from the case page.'}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link to={`/cases/${result.case.id}`}>
                <Button variant="secondary" className="w-full">
                  Open case <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Button
                onClick={() => {
                  setResult(null);
                  setForm({ ...EMPTY, bureau: user.bureau || '' });
                }}
              >
                Register another
              </Button>
            </div>
          </div>
        </motion.div>

        {result.overlaps.length > 0 ? (
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
            <h2 className="flex items-center gap-2 font-bold text-ink">
              <GitMerge className="h-5 w-5 text-ember-600" /> Review potential overlaps
            </h2>
            {result.overlaps.map((o) => (
              <EvidenceCard key={o.id} overlap={o} onDecided={(u) => setResult((r) => ({ ...r, overlaps: r.overlaps.map((x) => (x.id === u.id ? u : x)) }))} />
            ))}
          </motion.div>
        ) : (
          <p className="text-sm text-ink-muted">No duplicate or related cases were found for this institution.</p>
        )}
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        eyebrow="New case"
        title="Register a complaint"
        description="On save, the case is checked against every other case of the same institution across all bureaus."
        actions={
          meta?.demo && (
            <Button data-tour="new-demo" variant="secondary" icon={FlaskConical} onClick={() => setForm((f) => ({ ...f, ...DEMO, complainant: { ...DEMO.complainant } }))}>
              Fill demo complaint (Hindi)
            </Button>
          )
        }
      />

      <motion.form variants={stagger} initial="hidden" animate="show" onSubmit={submit} className="grid gap-5 xl:grid-cols-[1fr_340px]" noValidate>
        <div className="space-y-5">
          <Card className="space-y-4 p-5 sm:p-6">
            <h2 className="font-bold text-ink">Institution</h2>
            <Field data-tour="new-pid" label="AICTE Permanent ID" error={errors.permanentId} hint="Format: 1- followed by digits">
              <input className="input font-mono" value={form.permanentId} onChange={(e) => set('permanentId', e.target.value)} placeholder="1-2468013579" />
            </Field>
            <AnimatePresence mode="wait">
              {inst.state === 'loading' && (
                <motion.p key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-sm text-ink-muted">
                  <Loader2 className="h-4 w-4 animate-spin" /> Looking up institution…
                </motion.p>
              )}
              {inst.state === 'found' && (
                <motion.div key="f" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-3 rounded-2xl bg-ember-50 p-3">
                  <Building2 className="h-5 w-5 shrink-0 text-ember-600" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{inst.data.name}</p>
                    <p className="text-xs text-ink-muted">
                      {inst.data.city}, {inst.data.state} · {inst.data.stats.open} open case{inst.data.stats.open === 1 ? '' : 's'} in {inst.data.stats.bureaus.join(', ') || 'no bureau'}
                    </p>
                  </div>
                </motion.div>
              )}
              {inst.state === 'missing' && (
                <motion.p key="m" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm font-medium text-rosewood-700">
                  No institution with this Permanent ID.
                </motion.p>
              )}
            </AnimatePresence>
          </Card>

          <Card className="space-y-4 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold text-ink">Complaint</h2>
              {lang && (
                <span className="chip bg-teal-50 text-teal-700">
                  <Languages className="h-3.5 w-3.5" /> {lang}
                </span>
              )}
            </div>
            <Field label="Subject" error={errors.subject}>
              <input className={clsx('input', lang !== 'English' && 'font-hi')} value={form.subject} onChange={(e) => set('subject', e.target.value)} maxLength={200} />
            </Field>
            <Field data-tour="new-description" label="Description" error={errors.description} hint="Hindi, English or mixed — the semantic layer matches across languages">
              <textarea className={clsx('input min-h-[160px]', lang !== 'English' && 'font-hi')} value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={5000} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Category" error={errors.category}>
                <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
                  {meta?.categories.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Channel" error={errors.channel}>
                <select className="input" value={form.channel} onChange={(e) => set('channel', e.target.value)}>
                  {meta?.channels.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Priority" error={errors.priority}>
                <select className="input capitalize" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
                  {meta?.priorities.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="space-y-4 p-5 sm:p-6">
            <h2 className="font-bold text-ink">Complainant</h2>
            <Field label="Name" error={errors['complainant.name']}>
              <input className="input" value={form.complainant.name} onChange={(e) => setC('name', e.target.value)} autoComplete="off" />
            </Field>
            <Field label="Email" error={errors['complainant.email']}>
              <input className="input" type="email" value={form.complainant.email} onChange={(e) => setC('email', e.target.value)} autoComplete="off" />
            </Field>
            <Field label="Phone" error={errors['complainant.phone']}>
              <input className="input" value={form.complainant.phone} onChange={(e) => setC('phone', e.target.value)} autoComplete="off" />
            </Field>
            <p className="flex gap-2 text-xs text-ink-muted">
              <ShieldCheck className="h-4 w-4 shrink-0 text-sage-500" />
              Contact details are visible only to your bureau. Duplicates are matched on a one-way hash, never shared in cross-bureau views.
            </p>
          </Card>

          <Card className="space-y-4 p-5 sm:p-6">
            <Field label="Registering bureau">
              {user.role === 'admin' ? (
                <select className="input" value={form.bureau} onChange={(e) => set('bureau', e.target.value)}>
                  <option value="">Select bureau</option>
                  {meta?.bureaus.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.code} — {b.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input className="input" value={meta?.bureaus.find((b) => b.code === user.bureau)?.name || user.bureau} disabled />
              )}
            </Field>
            <Button type="submit" icon={Send} loading={saving} className="w-full py-3" data-tour="new-submit">
              {saving ? 'Checking for overlaps…' : 'Register & check overlaps'}
            </Button>
          </Card>
        </div>
      </motion.form>
    </Page>
  );
}
