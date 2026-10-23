import { Router } from 'express';
import { z } from 'zod';
import { Notification } from '../models/Notification.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [items, unread] = await Promise.all([
      Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(30).lean(),
      Notification.countDocuments({ user: req.user._id, read: false }),
    ]);
    res.json({ unread, notifications: items.map((n) => ({ ...n, id: n._id.toString() })) });
  }),
);

const readSchema = z.object({ ids: z.array(z.string().regex(/^[a-f0-9]{24}$/)).max(100).optional() });

router.post(
  '/read',
  asyncHandler(async (req, res) => {
    const { ids } = readSchema.parse(req.body || {});
    const filter = { user: req.user._id, read: false, ...(ids ? { _id: { $in: ids } } : {}) };
    const { modifiedCount } = await Notification.updateMany(filter, { read: true });
    res.json({ marked: modifiedCount });
  }),
);

export default router;
