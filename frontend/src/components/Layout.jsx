import { Suspense, useEffect, useState } from 'react';
import ErrorBoundary from './ErrorBoundary.jsx';
import { Skeleton } from './ui.jsx';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import {
  Building2,
  FileStack,
  GitMerge,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  ScrollText,
  Radar,
  FileUp,
  X,
  Compass,
  HandCoins,
} from 'lucide-react';
import { TourProvider, useTour } from './Tour.jsx';
import NotificationBell from './NotificationBell.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { ROLE_LABEL, initials } from '../lib/format.js';
import { Logo } from './Logo.jsx';
import { BureauBadge } from './badges.jsx';

const NAV = [
  {
    group: 'Monitor',
    items: [
      { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
      { to: '/institutions', label: 'Institution 360', icon: Building2 },
      { to: '/watchlist', label: 'Watchlist', icon: Radar, roles: ['senior_reviewer', 'admin', 'bureau_head'] },
    ],
  },
  {
    group: 'Act',
    items: [
      { to: '/cases', label: 'Cases', icon: FileStack },
      { to: '/overlaps', label: 'Overlap alerts', icon: GitMerge, badge: 'overlaps' },
      { to: '/promises', label: 'Promise ledger', icon: HandCoins, badge: 'promises' },
    ],
  },
  {
    group: 'Govern',
    items: [
      { to: '/audit', label: 'Audit trail', icon: ScrollText, roles: ['senior_reviewer', 'admin', 'bureau_head'] },
      { to: '/import', label: 'Import cases', icon: FileUp, roles: ['admin', 'bureau_head'] },
      { to: '/policy', label: 'Data & security', icon: ShieldCheck },
    ],
  },
];

function NavItems({ counts, onNavigate }) {
  const { user } = useAuth();
  return (
    <nav className="flex flex-col gap-4" aria-label="Main">
      {NAV.map((g) => {
        const items = g.items.filter((n) => !n.roles || n.roles.includes(user.role));
        if (!items.length) return null;
        return (
          <div key={g.group}>
            <p className="mb-1 px-3 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-ink-faint">{g.group}</p>
            <div className="flex flex-col gap-0.5">
      {items.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          onClick={onNavigate}
          data-tour={`nav-${n.to.slice(1) || 'overview'}`}
          className={({ isActive }) =>
            clsx(
              'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
              isActive ? 'text-ember-800' : 'text-ink-soft hover:bg-white/70 hover:text-ink',
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-xl bg-white shadow-card ring-1 ring-ember-100"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                >
                  <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-ember-500" />
                </motion.span>
              )}
              <n.icon className={clsx('relative h-[18px] w-[18px]', isActive ? 'text-ember-600' : 'text-ink-muted group-hover:text-ember-600')} />
              <span className="relative flex-1">{n.label}</span>
              {n.badge && counts[n.badge] > 0 && (
                <span className={clsx('relative grid min-w-[1.4rem] place-items-center rounded-full px-1.5 py-0.5 text-[0.7rem] font-bold', n.badge === 'overlaps' ? 'bg-ember-500 text-white' : 'bg-plum-100 text-plum-700')}>
                  {counts[n.badge]}
                </span>
              )}
            </>
          )}
        </NavLink>
      ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function UserCard({ onTour }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { start } = useTour();
  return (
    <div className="rounded-2xl border border-paper-line bg-white/80 p-3" data-tour="user">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-ember-200 to-ember-400 text-sm font-bold text-ember-950">
          {initials(user.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">{user.name}</p>
          <p className="truncate text-xs text-ink-muted">{ROLE_LABEL[user.role]}</p>
        </div>
        {user.bureau && <BureauBadge code={user.bureau} />}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => {
            onTour?.();
            setTimeout(start, onTour ? 350 : 0);
          }}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-paper-line py-2 text-xs font-semibold text-ink-soft transition hover:border-ember-200 hover:bg-ember-50 hover:text-ember-700"
        >
          <Compass className="h-3.5 w-3.5" /> Take the tour
        </button>
        <button
          onClick={async () => {
            await logout();
            navigate('/login');
          }}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-paper-line py-2 text-xs font-semibold text-ink-soft transition hover:border-rosewood-100 hover:bg-rosewood-50 hover:text-rosewood-700"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </div>
    </div>
  );
}

function PageTourButton() {
  const { start } = useTour();
  return (
    <button onClick={start} className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-ink-soft transition hover:bg-white hover:text-ember-700" data-tour="page-tour" aria-label="Tour this page">
      <Compass className="h-4 w-4" />
      <span className="hidden xl:inline">Tour this page</span>
    </button>
  );
}

function SearchBox({ className }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  return (
    <form
      data-tour="search"
      className={clsx('relative', className)}
      onSubmit={(e) => {
        e.preventDefault();
        const v = q.trim();
        if (!v) return;
        navigate(/^1-\d{5,12}$/.test(v) ? `/institutions/${v}` : `/institutions?q=${encodeURIComponent(v)}`);
        setQ('');
      }}
      role="search"
    >
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search institution or AICTE Permanent ID…"
        className="input rounded-full bg-white/80 py-2 pl-10"
        aria-label="Search institutions"
      />
    </form>
  );
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState({ overlaps: 0, promises: 0 });
  const location = useLocation();

  useEffect(() => {
    let alive = true;
    const load = () =>
      Promise.all([api.get('/overlaps/stats'), api.get('/promises', { params: { filter: 'awaiting' } })])
        .then(([o, p]) => alive && setCounts({ overlaps: o.data.pending, promises: p.data.stats.awaiting + p.data.stats.dueSoon }))
        .catch(() => {});
    load();
    const t = setInterval(load, 45000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [location.pathname]);

  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <TourProvider>
    <div className="min-h-screen lg:pl-72">
      <a href="#main" className="sr-only z-50 rounded-xl bg-white px-4 py-2 font-semibold text-ember-700 shadow-lift focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col gap-6 border-r border-paper-line bg-paper-soft/70 px-4 py-5 backdrop-blur lg:flex">
        <Logo className="px-2" />
        <NavItems counts={counts} />
        <div className="mt-auto space-y-3">
          <p className="px-2 text-[0.7rem] leading-relaxed text-ink-faint">Prototype · synthetic data only · SIH26264</p>
          <UserCard />
        </div>
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-paper-line/80 bg-paper/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button className="rounded-xl p-2 text-ink-soft hover:bg-white lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu" data-tour="menu">
            <Menu className="h-5 w-5" />
          </button>
          <Logo className="lg:hidden" />
          <SearchBox className="ml-auto hidden w-full max-w-md md:block" />
          <div className="ml-auto flex items-center gap-1 md:ml-2">
            <PageTourButton />
            <div data-tour="bell">
              <NotificationBell />
            </div>
          </div>
        </div>
        <div className="px-4 pb-3 md:hidden">
          <SearchBox />
        </div>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-[2px] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 flex w-[85%] max-w-xs flex-col gap-6 bg-paper px-4 py-5 shadow-lift lg:hidden"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 34 }}
            >
              <div className="flex items-center justify-between">
                <Logo />
                <button className="rounded-xl p-2 text-ink-soft hover:bg-white" onClick={() => setOpen(false)} aria-label="Close menu">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <NavItems counts={counts} onNavigate={() => setOpen(false)} />
              <div className="mt-auto">
                <UserCard onTour={() => setOpen(false)} />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main id="main" key={location.pathname} tabIndex={-1} className="outline-none">
        <ErrorBoundary>
          <Suspense
            fallback={
              <div className="mx-auto max-w-7xl space-y-4 px-4 pt-6 sm:px-6 lg:px-8">
                <Skeleton className="h-10 w-72" />
                <Skeleton className="h-64" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
    </TourProvider>
  );
}
