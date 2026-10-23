import { Router } from 'express';
import { authorize } from '../middleware/auth.js';
import { computeWatchlist } from '../services/watchlist.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();

router.get(
  '/',
  authorize('senior_reviewer', 'admin', 'bureau_head'),
  asyncHandler(async (_req, res) => {
    res.json(await computeWatchlist());
  }),
);

export default router;
