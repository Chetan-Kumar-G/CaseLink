import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, animate, motion, useInView } from 'framer-motion';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import clsx from 'clsx';
import { LogoMark } from './Logo.jsx';

export const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 26 } },
};
export const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

export function Page({ children, className }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={clsx('mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8', className)}
    >
      {children}
    </motion.div>
  );
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div data-tour="page-header" className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-ember-600">{eyebrow}</p>}
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-[1.75rem]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const BUTTON = {
  primary: 'bg-gradient-to-b from-ember-500 to-ember-600 text-white shadow-[0_8px_20px_-10px_rgba(219,84,14,0.8)] hover:from-ember-500 hover:to-ember-700',
  secondary: 'border border-paper-line bg-white text-ink hover:border-ember-300 hover:bg-ember-50',
  ghost: 'text-ink-soft hover:bg-ember-50 hover:text-ember-700',
  danger: 'border border-rosewood-100 bg-rosewood-50 text-rosewood-700 hover:bg-rosewood-100',
  teal: 'bg-teal-600 text-white hover:bg-teal-700',
};

export function Button({ variant = 'primary', size = 'md', loading, icon: Icon, children, className, ...props }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      className={clsx(
        'inline-flex select-none items-center whitespace-nowrap justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm',
        BUTTON[variant],
        className,
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon && <Icon className="h-4 w-4" />}
      {children}
    </motion.button>
  );
}

export function Card({ className, children, ...props }) {
  return (
    <motion.div variants={fadeUp} className={clsx('card', className)} {...props}>
      {children}
    </motion.div>
  );
}

export function Field({ label, error, hint, children, className, 'data-tour': tour }) {
  return (
    <label className={clsx('block', className)} data-tour={tour}>
      {label && <span className="label">{label}</span>}
      {children}
      {error ? (
        <span className="mt-1 block text-xs font-medium text-rosewood-700">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-xs text-ink-faint">{hint}</span>
      )}
    </label>
  );
}

export function Spinner({ className }) {
  return <Loader2 className={clsx('h-5 w-5 animate-spin text-ember-500', className)} />;
}

export function Skeleton({ className }) {
  return (
    <div className={clsx('relative overflow-hidden rounded-xl bg-paper-deep/70', className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent" />
    </div>
  );
}

export function FullPageLoader() {
  return (
    <div className="grid min-h-screen place-items-center">
      <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.4 }}>
        <LogoMark className="h-12 w-12" />
      </motion.div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl2 border border-dashed border-paper-line bg-paper-soft/60 px-6 py-12 text-center">
      {Icon && (
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-ember-100 text-ember-600">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <p className="font-semibold text-ink">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-ink-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl2 border border-rosewood-100 bg-rosewood-50 px-6 py-10 text-center">
      <AlertTriangle className="h-6 w-6 text-rosewood-500" />
      <p className="text-sm font-medium text-rosewood-700">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function AnimatedNumber({ value = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!inView) return undefined;
    const controls = animate(0, value, { duration: 0.9, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setDisplay(Math.round(v)) });
    return () => controls.stop();
  }, [value, inView]);
  return <span ref={ref}>{display.toLocaleString('en-IN')}</span>;
}

const TONES = {
  ember: 'bg-ember-100 text-ember-700',
  teal: 'bg-teal-50 text-teal-700',
  plum: 'bg-plum-50 text-plum-700',
  sage: 'bg-sage-50 text-sage-700',
  honey: 'bg-honey-50 text-honey-700',
  rosewood: 'bg-rosewood-50 text-rosewood-700',
};

export function StatTile({ icon: Icon, label, value, hint, tone = 'ember', pulse }) {
  return (
    <Card className="group relative overflow-hidden p-4 transition-shadow hover:shadow-lift sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
            <AnimatedNumber value={value} />
          </p>
          {hint && <p className="mt-1 truncate text-xs text-ink-faint">{hint}</p>}
        </div>
        {Icon && (
          <div className={clsx('relative grid h-10 w-10 shrink-0 place-items-center rounded-xl', TONES[tone])}>
            {pulse && value > 0 && <span className="absolute inset-0 animate-ping rounded-xl bg-current opacity-20" />}
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      <div className="pointer-events-none absolute -bottom-10 -right-10 h-28 w-28 rounded-full bg-ember-100/50 opacity-0 blur-2xl transition-opacity group-hover:opacity-100" />
    </Card>
  );
}

export function Modal({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Portalled to <body> so transformed (animated) ancestors cannot clip the fixed overlay.
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="relative max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-lift sm:max-w-lg sm:rounded-3xl sm:p-6"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 className="text-lg font-bold text-ink">{title}</h2>
              <button onClick={onClose} className="rounded-lg p-1 text-ink-muted hover:bg-paper-soft" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            {children}
            {footer && <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
