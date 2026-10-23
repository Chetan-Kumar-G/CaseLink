import { Case } from '../models/Case.js';
import { OPEN_STATUSES, WATCHLIST, categoryLabel } from '../config/domain.js';

const DAY = 86_400_000;

/**
 * Institution × category pairs whose recent complaint volume is unusually
 * high compared with that institution's own history. This is a prompt for
 * senior review, never a finding of wrongdoing: volume can rise for many
 * reasons, including better awareness of the grievance channel.
 */
export async function computeWatchlist(now = new Date(), cfg = WATCHLIST) {
  const windowStart = new Date(now.getTime() - cfg.windowDays * DAY);
  const baselineStart = new Date(windowStart.getTime() - cfg.baselineDays * DAY);

  const rows = await Case.aggregate([
    { $match: { createdAt: { $gte: baselineStart, $lte: now } } },
    {
      $group: {
        _id: { institution: '$institution', category: '$category' },
        recent: { $sum: { $cond: [{ $gte: ['$createdAt', windowStart] }, 1, 0] } },
        baseline: { $sum: { $cond: [{ $lt: ['$createdAt', windowStart] }, 1, 0] } },
        open: { $sum: { $cond: [{ $and: [{ $gte: ['$createdAt', windowStart] }, { $in: ['$status', OPEN_STATUSES] }] }, 1, 0] } },
        bureaus: { $addToSet: { $cond: [{ $gte: ['$createdAt', windowStart] }, '$bureau', '$$REMOVE'] } },
        channels: { $addToSet: { $cond: [{ $gte: ['$createdAt', windowStart] }, '$channel', '$$REMOVE'] } },
        firstRecent: { $min: { $cond: [{ $gte: ['$createdAt', windowStart] }, '$createdAt', null] } },
        lastRecent: { $max: { $cond: [{ $gte: ['$createdAt', windowStart] }, '$createdAt', null] } },
      },
    },
    { $match: { recent: { $gte: cfg.minCount } } },
    { $lookup: { from: 'institutions', localField: '_id.institution', foreignField: '_id', as: 'inst' } },
    { $unwind: '$inst' },
  ]);

  const items = [];
  for (const r of rows) {
    // Expected count in a window of the same length, from the baseline rate.
    const expected = (r.baseline * cfg.windowDays) / cfg.baselineDays;
    const ratio = r.recent / Math.max(expected, 0.5);
    if (ratio < cfg.minRatio) continue;
    items.push({
      institution: { id: r.inst._id.toString(), name: r.inst.name, permanentId: r.inst.permanentId, city: r.inst.city, state: r.inst.state },
      category: r._id.category,
      categoryLabel: categoryLabel(r._id.category),
      recent: r.recent,
      open: r.open,
      baseline: r.baseline,
      expected: Number(expected.toFixed(2)),
      ratio: Number(ratio.toFixed(1)),
      bureaus: r.bureaus.sort(),
      channels: r.channels.sort(),
      firstRecent: r.firstRecent,
      lastRecent: r.lastRecent,
      signal: `${r.recent} ${categoryLabel(r._id.category).toLowerCase()} complaints in ${cfg.windowDays} days against an expected ${expected < 1 ? 'fewer than 1' : expected.toFixed(1)}`,
    });
  }
  items.sort((a, b) => b.ratio - a.ratio || b.recent - a.recent);
  return { config: cfg, generatedAt: now, items };
}
