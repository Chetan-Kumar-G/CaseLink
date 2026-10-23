import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Eye, EyeOff, Fingerprint, GitMerge, Lock, ScrollText } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { errorMessage } from '../lib/api.js';
import { Logo } from '../components/Logo.jsx';
import { Button, Field } from '../components/ui.jsx';

// Demo accounts come from the server, and only in development or a DEMO_MODE
// deployment (synthetic data). A real deployment shows nothing here.
const ROLE_NAME = { officer: 'officer', bureau_head: 'bureau head', senior_reviewer: 'Senior reviewer', admin: 'Administrator', institution: 'Institution portal' };
const demoLabel = (a) => (a.bureau ? `${a.bureau} ${ROLE_NAME[a.role]}` : ROLE_NAME[a.role]);

// Animated hero: three bureau threads converge into one institution record.
function ConvergingThreads() {
  const reduce = useReducedMotion();
  const threads = [
    { d: 'M64 60 C 200 60, 230 170, 360 170', label: 'PGRC', y: 60 },
    { d: 'M64 170 C 180 170, 230 170, 360 170', label: 'RB', y: 170 },
    { d: 'M64 280 C 200 280, 230 170, 360 170', label: 'AB', y: 280 },
  ];
  return (
    <svg viewBox="0 0 440 340" className="h-auto w-full max-w-md" aria-hidden="true">
      {threads.map((t, i) => (
        <g key={t.label}>
          <motion.path d={t.d} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="10" strokeLinecap="round" />
          <motion.path
            d={t.d}
            fill="none"
            stroke="#fff"
            strokeWidth="2.5"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: 0.3 + i * 0.25, duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
          />
          {!reduce && (
            <circle r="5" fill="#FFE9D5" opacity="0">
              <animateMotion path={t.d} dur="2.4s" begin={`${1.8 + i * 0.6}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;1;1;0" dur="2.4s" begin={`${1.8 + i * 0.6}s`} repeatCount="indefinite" />
            </circle>
          )}
          <motion.g initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.25 }}>
            <rect x="0" y={t.y - 14} width="56" height="28" rx="14" fill="rgba(255,255,255,0.16)" />
            <text x="28" y={t.y + 5} textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff" fontFamily="Plus Jakarta Sans">
              {t.label}
            </text>
          </motion.g>
        </g>
      ))}
      <motion.g initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 1.5, type: 'spring', stiffness: 200, damping: 14 }} style={{ transformOrigin: '380px 170px' }}>
        <motion.circle cx="380" cy="170" r="38" fill="rgba(255,255,255,0.12)" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 3 }} />
        <circle cx="380" cy="170" r="30" fill="#fff" />
        <image href="/brand/caselink-mark.png" x="356" y="146" width="48" height="48" />
      </motion.g>
    </svg>
  );
}

export default function Login() {
  const { login, meta } = useAuth();
  const demo = meta?.demo;
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const u = await login(email, password);
      const home = u.role === 'institution' ? '/portal' : '/';
      const from = location.state?.from;
      // Only return to the previous page if it belongs to this user's area.
      const sameArea = from && (home === '/portal') === from.startsWith('/portal');
      navigate(sameArea ? from : home, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-ember-500 via-ember-600 to-ember-800 p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-ember-300/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-ember-900/40 blur-3xl" />
        <Logo light className="relative" />
        <div className="relative my-auto">
          <ConvergingThreads />
          <motion.h2 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="mt-8 max-w-md text-4xl font-extrabold leading-tight tracking-tight">
            One institution.
            <br />
            Connected grievances.
            <br />
            <span className="text-ember-100">Every bureau.</span>
          </motion.h2>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="mt-4 max-w-md text-ember-50/90">
            See every complaint about an institution across AICTE bureaus, catch duplicate and related cases early, and keep a tamper-evident record of every decision.
          </motion.p>
        </div>
        <div className="relative flex flex-wrap gap-2 text-xs font-semibold">
          {[
            [Fingerprint, 'AICTE Permanent ID anchored'],
            [GitMerge, 'Cross-bureau overlap alerts'],
            [ScrollText, 'Hash-chained audit trail'],
          ].map(([Icon, text]) => (
            <span key={text} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 backdrop-blur">
              <Icon className="h-3.5 w-3.5" /> {text}
            </span>
          ))}
        </div>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center px-4 py-10 sm:px-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 24 }} className="w-full max-w-md">
          <Logo className="mb-10 lg:hidden" />
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">Sign in</h1>
          <p className="mt-2 text-sm text-ink-muted">Authorised AICTE officials only. All activity is recorded.</p>

          <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
            <Field label="Official email">
              <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@aicte.gov.in" required />
            </Field>
            <Field label="Password">
              <div className="relative">
                <input className="input pr-11" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-muted hover:bg-paper-soft" aria-label={show ? 'Hide password' : 'Show password'}>
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>

            {error && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-rosewood-50 px-3.5 py-2.5 text-sm font-medium text-rosewood-700" role="alert">
                {error}
              </motion.p>
            )}

            <Button type="submit" loading={loading} className="w-full py-3">
              Sign in <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <p className="mt-6 flex items-center gap-2 text-xs text-ink-faint">
            <Lock className="h-3.5 w-3.5" /> Session stored in a secure httpOnly cookie · locks after 5 failed attempts
          </p>

          {demo?.accounts?.length > 0 && (
            <div className="mt-8 rounded-2xl border border-dashed border-ember-200 bg-ember-50/60 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-ember-700">Demo accounts · synthetic data</p>
              <p className="mt-1 text-xs text-ink-muted">
                Pick one to fill in the form. Password for all: <code className="rounded bg-white px-1 font-mono text-ink">{demo.password}</code>
              </p>
              <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {demo.accounts.map((a) => (
                  <button
                    key={a.email}
                    type="button"
                    onClick={() => {
                      setEmail(a.email);
                      setPassword(demo.password);
                    }}
                    className="rounded-xl bg-white px-3 py-2 text-left text-xs ring-1 ring-paper-line transition hover:ring-ember-300"
                  >
                    <span className="block font-semibold capitalize text-ink">{demoLabel(a)}</span>
                    <span className="block truncate text-ink-muted">{a.email}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
