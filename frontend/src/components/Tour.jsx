import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { tourFor } from '../lib/tourSteps.js';
import { LogoMark } from './Logo.jsx';
import { PENDING_KEY, offKey, safe } from '../lib/tourState.js';

/**
 * Page-by-page guided tours. Each route has its own short tour (lib/tourSteps).
 * A page's tour opens automatically the first time it is visited in a sign-in
 * session — the overview tour carries the welcome — unless the user turned
 * automatic tours off. "Tour this page" replays the current page's tour.
 * Steps point at elements marked data-tour="…"; a step whose target is not on
 * screen falls back to its `alt` target or is skipped.
 */

const TALL = 0.42; // share of the viewport a spotlight may cover
const seenKey = (key) => `cl_tour_seen_${key}`;

const TourContext = createContext({ start: () => {} });
export const useTour = () => useContext(TourContext);

function visibleTarget(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(`[data-tour="${sel}"]`);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    if (r.width > 0 && r.height > 0 && style.visibility !== 'hidden') return el;
  }
  return null;
}

const forRole = (steps, user) => steps.filter((s) => !s.roles || s.roles.includes(user.role));
const onScreen = (s) => !s.target || visibleTarget([s.target, ...(s.alt || [])]);

export function TourProvider({ children }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const { key, steps } = useMemo(() => tourFor(pathname), [pathname]);
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [dontShow, setDontShow] = useState(false);
  const nextRef = useRef(null);

  // Resolve steps against what is actually on screen when the tour starts.
  const [resolved, setResolved] = useState([]);

  const start = useCallback(() => {
    if (!user) return;
    const list = forRole(steps, user).filter(onScreen);
    if (!list.length) return;
    setResolved(list);
    setIndex(0);
    setDontShow(Boolean(safe(() => localStorage.getItem(offKey(user.id)))));
    setActive(true);
  }, [steps, user]);

  // A tour belongs to its page: leaving the page closes it.
  useEffect(() => setActive(false), [pathname]);

  // Auto-start on the first visit to this page in this sign-in session. Waits
  // (up to ~3.5 s) for the page's data-driven anchors to render first.
  useEffect(() => {
    if (!user || !key || !steps.length) return undefined;
    const off = safe(() => localStorage.getItem(offKey(user.id)));
    const seen = safe(() => sessionStorage.getItem(seenKey(key)));
    if (off || seen) return undefined;
    const wanted = forRole(steps, user).filter((s) => s.target).length;
    const began = Date.now();
    let timer;
    const poll = () => {
      const ready = forRole(steps, user).filter((s) => s.target && onScreen(s)).length;
      const waited = Date.now() - began;
      if ((ready >= wanted && waited > 900) || waited > 3500) {
        // Mark seen only when the tour actually starts, so a strict-mode
        // re-run of this effect cannot swallow it.
        safe(() => sessionStorage.setItem(seenKey(key), '1'));
        safe(() => sessionStorage.removeItem(PENDING_KEY));
        start();
      } else timer = setTimeout(poll, 250);
    };
    timer = setTimeout(poll, 400);
    return () => clearTimeout(timer);
  }, [user, key, steps, start]);

  const step = resolved[index];

  const measure = useCallback(() => {
    if (!step?.target) return setRect(null);
    const el = visibleTarget([step.target, ...(step.alt || [])]);
    if (!el) return setRect(null);
    const r = el.getBoundingClientRect();
    const pad = step.pad ?? 8;
    // Tall targets (long lists) are capped so the spotlight and card both fit.
    const height = Math.min(r.height, window.innerHeight * TALL);
    setRect({ top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: height + pad * 2 });
  }, [step]);

  useLayoutEffect(() => {
    if (!active || !step) return undefined;
    const el = step.target && visibleTarget([step.target, ...(step.alt || [])]);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.height > window.innerHeight * TALL) window.scrollBy({ top: r.top - 96, behavior: 'smooth' });
      else if (r.top < 80 || r.bottom > window.innerHeight - 40) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    measure();
    const t = setTimeout(measure, 350); // after smooth scroll
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [active, step, measure]);

  const finish = useCallback(() => {
    if (user) safe(() => (dontShow ? localStorage.setItem(offKey(user.id), '1') : localStorage.removeItem(offKey(user.id))));
    setActive(false);
  }, [dontShow, user]);

  const next = useCallback(() => (index < resolved.length - 1 ? setIndex((i) => i + 1) : finish()), [index, resolved.length, finish]);
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') finish();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    nextRef.current?.focus({ preventScroll: true });
    return () => window.removeEventListener('keydown', onKey);
  }, [active, index, next, back, finish]);

  const value = useMemo(() => ({ start }), [start]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {createPortal(
        <AnimatePresence>
          {active && step && (
            <TourOverlay
              key="tour"
              step={step}
              index={index}
              total={resolved.length}
              rect={rect}
              user={user}
              dontShow={dontShow}
              setDontShow={setDontShow}
              onNext={next}
              onBack={back}
              onClose={finish}
              nextRef={nextRef}
            />
          )}
        </AnimatePresence>,
        document.body,
      )}
    </TourContext.Provider>
  );
}

const CARD_W = 340;
const GAP = 14;

function placeCard(rect, cardH) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(CARD_W, vw - 32);
  if (!rect) return { width, left: (vw - width) / 2, top: Math.max(16, (vh - cardH) / 2) };
  const clampX = (x) => Math.min(Math.max(16, x), vw - width - 16);
  // Prefer the right side for tall, narrow targets (sidebar items), else below/above.
  if (rect.left + rect.width + GAP + width < vw - 16 && rect.height < vh * 0.6 && rect.left < vw * 0.35) {
    return { width, left: rect.left + rect.width + GAP, top: Math.min(Math.max(16, rect.top + rect.height / 2 - cardH / 2), vh - cardH - 16) };
  }
  const below = rect.top + rect.height + GAP;
  if (below + cardH < vh - 16) return { width, left: clampX(rect.left + rect.width / 2 - width / 2), top: below };
  const above = rect.top - GAP - cardH;
  if (above > 16) return { width, left: clampX(rect.left + rect.width / 2 - width / 2), top: above };
  return { width, left: clampX(rect.left + rect.width / 2 - width / 2), top: Math.max(16, vh - cardH - 16) };
}

function TourOverlay({ step, index, total, rect, user, dontShow, setDontShow, onNext, onBack, onClose, nextRef }) {
  const cardRef = useRef(null);
  const [cardH, setCardH] = useState(220);
  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
  }, [step, rect]);
  const pos = placeCard(rect, cardH);
  const last = index === total - 1;
  const first = index === 0;
  const Icon = step.icon;
  const title = typeof step.title === 'function' ? step.title(user) : step.title;

  return (
    <motion.div className="fixed inset-0 z-[70]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} aria-live="polite">
      {/* Click-blocker; the dimming comes from the spotlight's box-shadow. */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />
      {rect ? (
        <motion.div
          className="pointer-events-none absolute rounded-2xl ring-2 ring-ember-400"
          style={{ boxShadow: '0 0 0 9999px rgba(35, 27, 22, 0.62)' }}
          initial={false}
          animate={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
          transition={{ type: 'spring', stiffness: 260, damping: 30 }}
        >
          <motion.span
            className="absolute inset-0 rounded-2xl ring-4 ring-ember-300/60"
            animate={{ opacity: [0.9, 0.2, 0.9], scale: [1, 1.04, 1] }}
            transition={{ repeat: Infinity, duration: 1.8 }}
          />
        </motion.div>
      ) : (
        <div className="absolute inset-0 bg-ink/60 backdrop-blur-[2px]" />
      )}

      <motion.div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Tour step ${index + 1} of ${total}: ${title}`}
        className="absolute overflow-hidden rounded-3xl border border-paper-line bg-white shadow-lift"
        initial={false}
        animate={{ top: pos.top, left: pos.left, width: pos.width }}
        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      >
        <div className="h-1 bg-paper-deep">
          <motion.div className="h-full bg-gradient-to-r from-ember-400 to-ember-600" animate={{ width: `${((index + 1) / total) * 100}%` }} transition={{ duration: 0.4 }} />
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={index} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="p-5">
            <div className="flex items-start gap-3">
              {step.welcome ? (
                <motion.div initial={{ rotate: -20, scale: 0.6 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 12 }}>
                  <LogoMark className="h-12 w-12" />
                </motion.div>
              ) : (
                Icon && (
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ember-100 text-ember-700">
                    <Icon className="h-5 w-5" />
                  </div>
                )
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-ember-600">
                  {step.welcome ? 'Welcome tour' : `Step ${index + 1} of ${total}`}
                </p>
                <h3 className="mt-0.5 font-extrabold leading-snug text-ink">{title}</h3>
              </div>
              <button onClick={onClose} className="-mr-1 -mt-1 rounded-lg p-1 text-ink-faint hover:bg-paper-soft hover:text-ink" aria-label="Close tour">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">{step.body}</p>
            {step.tip && <p className="mt-2 rounded-xl bg-paper-soft px-3 py-2 text-xs text-ink-muted">{step.tip}</p>}
          </motion.div>
        </AnimatePresence>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-paper-line px-5 py-3">
          <div className="flex items-center gap-1" aria-hidden="true">
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={clsx('h-1.5 rounded-full transition-all', i === index ? 'w-4 bg-ember-500' : i < index ? 'w-1.5 bg-ember-300' : 'w-1.5 bg-paper-deep')} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {first ? (
              <button onClick={onClose} className="rounded-xl px-3 py-2 text-xs font-semibold text-ink-muted hover:bg-paper-soft">
                Skip tour
              </button>
            ) : (
              <button onClick={onBack} className="flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold text-ink-soft hover:bg-paper-soft" aria-label="Previous step">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            )}
            <motion.button
              ref={nextRef}
              whileTap={{ scale: 0.96 }}
              onClick={onNext}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-ember-500 to-ember-600 px-4 py-2 text-xs font-bold text-white shadow-[0_8px_20px_-10px_rgba(219,84,14,0.8)]"
            >
              {last ? (
                <>
                  Finish <Check className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  {first ? 'Start tour' : 'Next'} <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </motion.button>
          </div>
        </div>
        {(first || last) && (
          <label className="flex cursor-pointer items-center gap-2 border-t border-paper-line bg-paper/60 px-5 py-2.5 text-xs text-ink-muted">
            <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} className="h-3.5 w-3.5 accent-ember-600" />
            Don’t open tours automatically
          </label>
        )}
      </motion.div>
    </motion.div>
  );
}
