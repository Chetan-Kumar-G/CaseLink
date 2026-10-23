// Tour flags kept outside React modules so AuthContext and Tour do not import
// each other. Storage can be unavailable (private mode), so every call is guarded.
export const PENDING_KEY = 'cl_tour_pending';
export const offKey = (userId) => `cl_tour_off_${userId}`;

export const safe = (fn, fallback = null) => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

// Called on sign-in: every page's tour becomes "unseen" again for this session.
export const markTourPending = () =>
  safe(() => {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith('cl_tour_seen_'))
      .forEach((k) => sessionStorage.removeItem(k));
    sessionStorage.setItem(PENDING_KEY, '1');
  });
