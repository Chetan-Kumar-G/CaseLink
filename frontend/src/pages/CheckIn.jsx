import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { CheckCircle2, CircleDashed, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { api, errorMessage } from '../lib/api.js';
import { formatDate } from '../lib/format.js';
import { Logo } from '../components/Logo.jsx';

const ANSWERS = [
  { key: 'yes', label: 'Yes, I received it', icon: CheckCircle2, cls: 'border-sage-100 hover:border-sage-500 hover:bg-sage-50 text-sage-700' },
  { key: 'partly', label: 'Partly', icon: CircleDashed, cls: 'border-honey-100 hover:border-honey-500 hover:bg-honey-50 text-honey-700' },
  { key: 'no', label: 'No, I did not', icon: XCircle, cls: 'border-rosewood-100 hover:border-rosewood-500 hover:bg-rosewood-50 text-rosewood-700' },
];

const money = (n) => (n ? `Rs ${Number(n).toLocaleString('en-IN')}` : null);

/** Public one-tap check-in for the complainant (link from SMS/email, no login). */
export default function CheckIn() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState('');
  const [done, setDone] = useState(null);

  useEffect(() => {
    api.get(`/checkin/${encodeURIComponent(token)}`).then((r) => setInfo(r.data)).catch((e) => setError(errorMessage(e, 'This link is not valid')));
  }, [token]);

  const answer = async (key) => {
    setSending(key);
    try {
      const { data } = await api.post(`/checkin/${encodeURIComponent(token)}`, { answer: key, comment: comment.trim() || undefined });
      setDone({ answer: key, reopened: data.reopened });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSending('');
    }
  };

  const answered = info && info.status !== 'awaiting_confirmation';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Logo className="mb-8" />
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md overflow-hidden rounded-3xl border border-paper-line bg-white shadow-lift">
        {!info && !error && (
          <div className="grid place-items-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-ember-500" />
          </div>
        )}
        {error && !done && <p className="p-8 text-center text-sm font-medium text-rosewood-700">{error}</p>}

        <AnimatePresence mode="wait">
          {info && !done && !error && (
            <motion.div key="ask" exit={{ opacity: 0, y: -8 }} className="p-6 sm:p-7">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-ember-600">Grievance follow-up · {info.caseRef}</p>
              <h1 className="mt-2 text-xl font-extrabold leading-snug text-ink">
                {info.institution} promised: {info.action.toLowerCase()}
                {money(info.amount) && <> of {money(info.amount)}</>}
              </h1>
              <blockquote className="mt-3 rounded-2xl bg-paper-soft p-3 text-sm italic text-ink-soft">“{info.promiseText}”</blockquote>
              <p className="mt-2 text-xs text-ink-muted">Deadline: {formatDate(info.dueDate)}</p>

              {answered ? (
                <p className="mt-6 rounded-2xl bg-paper-soft p-4 text-sm text-ink-soft">This check-in has already been answered{info.answer ? ` (${info.answer})` : ''}. Thank you.</p>
              ) : (
                <>
                  <p className="mt-6 font-bold text-ink">Has the institution kept this promise?</p>
                  <div className="mt-3 grid gap-2.5">
                    {ANSWERS.map((a) => (
                      <motion.button
                        key={a.key}
                        whileTap={{ scale: 0.98 }}
                        disabled={Boolean(sending)}
                        onClick={() => answer(a.key)}
                        className={clsx('flex items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3.5 text-left font-bold transition disabled:opacity-60', a.cls)}
                      >
                        {sending === a.key ? <Loader2 className="h-5 w-5 animate-spin" /> : <a.icon className="h-5 w-5" />}
                        {a.label}
                      </motion.button>
                    ))}
                  </div>
                  <label className="mt-4 block text-xs text-ink-muted">
                    Anything to add? (optional)
                    <textarea className="input mt-1 min-h-[70px]" maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="e.g. Only half the amount was received" />
                  </label>
                </>
              )}
            </motion.div>
          )}

          {done && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="p-8 text-center">
              <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }} className={clsx('mx-auto grid h-16 w-16 place-items-center rounded-2xl text-white', done.answer === 'yes' ? 'bg-sage-500' : 'bg-ember-500')}>
                {done.answer === 'yes' ? <CheckCircle2 className="h-8 w-8" /> : <ShieldCheck className="h-8 w-8" />}
              </motion.div>
              <h2 className="mt-4 text-xl font-extrabold text-ink">Thank you</h2>
              <p className="mt-2 text-sm text-ink-soft">
                {done.answer === 'yes'
                  ? 'We have recorded that the promise was kept.'
                  : 'Your complaint has been reopened and sent back to the AICTE officer, with the institution’s promise attached as evidence.'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      <p className="mt-6 max-w-sm text-center text-xs text-ink-faint">This page shows no personal details. The link works once and expires after 7 days.</p>
    </div>
  );
}
