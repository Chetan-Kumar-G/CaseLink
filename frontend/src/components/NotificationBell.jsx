import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { AlarmClock, Bell, CheckCheck, GitMerge, Handshake, Inbox, MessageSquareReply, ShieldCheck, TrendingUp } from 'lucide-react';
import { api } from '../lib/api.js';
import { timeAgo } from '../lib/format.js';

const ICON = {
  overlap: { icon: GitMerge, cls: 'bg-ember-100 text-ember-700' },
  coordination: { icon: Handshake, cls: 'bg-teal-50 text-teal-700' },
  reminder: { icon: AlarmClock, cls: 'bg-honey-50 text-honey-700' },
  escalation: { icon: TrendingUp, cls: 'bg-rosewood-50 text-rosewood-700' },
  response: { icon: MessageSquareReply, cls: 'bg-plum-50 text-plum-700' },
  closure: { icon: ShieldCheck, cls: 'bg-sage-50 text-sage-700' },
  assignment: { icon: Inbox, cls: 'bg-paper-deep text-ink-soft' },
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ unread: 0, notifications: [] });
  const ref = useRef(null);
  const navigate = useNavigate();

  const load = useCallback(() => api.get('/notifications').then((r) => setData(r.data)).catch(() => {}), []);

  useEffect(() => {
    load();
    const t = setInterval(load, 45000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const markRead = async (ids) => {
    await api.post('/notifications/read', ids ? { ids } : {}).catch(() => {});
    load();
  };

  const openItem = (n) => {
    if (!n.read) markRead([n.id]);
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
        className="relative grid h-10 w-10 place-items-center rounded-full text-ink-soft transition hover:bg-white hover:text-ember-700"
        aria-label={`Notifications${data.unread ? `, ${data.unread} unread` : ''}`}
        aria-expanded={open}
      >
        <motion.span animate={data.unread ? { rotate: [0, -12, 10, -6, 0] } : {}} transition={{ duration: 0.6, repeat: data.unread ? Infinity : 0, repeatDelay: 6 }}>
          <Bell className="h-5 w-5" />
        </motion.span>
        {data.unread > 0 && (
          <span className="absolute right-1 top-1 grid h-[1.15rem] min-w-[1.15rem] place-items-center rounded-full bg-ember-500 px-1 text-[0.65rem] font-bold text-white ring-2 ring-paper">
            {data.unread > 99 ? '99+' : data.unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-x-3 top-16 z-50 overflow-hidden rounded-2xl border border-paper-line bg-white shadow-lift sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96"
          >
            <div className="flex items-center justify-between border-b border-paper-line px-4 py-3">
              <p className="font-bold text-ink">Notifications</p>
              {data.unread > 0 && (
                <button onClick={() => markRead()} className="flex items-center gap-1 text-xs font-semibold text-ember-700 hover:underline">
                  <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                </button>
              )}
            </div>
            <ul className="max-h-[60vh] divide-y divide-paper-line overflow-y-auto">
              {data.notifications.length === 0 && <li className="px-4 py-10 text-center text-sm text-ink-muted">You’re all caught up.</li>}
              {data.notifications.map((n) => {
                const I = ICON[n.type] || ICON.assignment;
                return (
                  <li key={n.id}>
                    <button onClick={() => openItem(n)} className={clsx('flex w-full gap-3 px-4 py-3 text-left transition hover:bg-paper-soft', !n.read && 'bg-ember-50/50')}>
                      <span className={clsx('grid h-8 w-8 shrink-0 place-items-center rounded-lg', I.cls)}>
                        <I.icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={clsx('block text-sm', n.read ? 'text-ink-soft' : 'font-semibold text-ink')}>{n.title}</span>
                        {n.body && <span className="mt-0.5 line-clamp-2 block text-xs text-ink-muted">{n.body}</span>}
                        <span className="mt-1 block text-[0.7rem] text-ink-faint">{timeAgo(n.createdAt)}</span>
                      </span>
                      {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-ember-500" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
