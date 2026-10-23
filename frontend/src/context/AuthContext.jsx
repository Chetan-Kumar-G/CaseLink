import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler } from '../lib/api.js';
import { markTourPending } from '../lib/tourState.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [meta, setMeta] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    Promise.allSettled([api.get('/auth/me'), api.get('/meta')]).then(([me, m]) => {
      if (me.status === 'fulfilled') setUser(me.value.data.user);
      if (m.status === 'fulfilled') setMeta(m.value.data);
      setReady(true);
    });
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    markTourPending(); // the welcome tour runs after every sign-in
    setUser(data.user);
    if (!meta) api.get('/meta').then((r) => setMeta(r.data)).catch(() => {});
    return data.user;
  }, [meta]);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({ user, meta, ready, login, logout }), [user, meta, ready, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export function useMeta() {
  const { meta } = useAuth();
  return useMemo(() => {
    const find = (list, code) => list?.find((x) => x.code === code);
    return {
      meta,
      bureauName: (c) => find(meta?.bureaus, c)?.name || c,
      categoryLabel: (c) => find(meta?.categories, c)?.label || c,
      channelLabel: (c) => find(meta?.channels, c)?.label || c,
      statusLabel: (c) => find(meta?.statuses, c)?.label || c?.replace(/_/g, ' '),
    };
  }, [meta]);
}
