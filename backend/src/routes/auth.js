import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { User } from '../models/User.js';
import { SESSION_COOKIE, authenticate, sessionCookieOptions, signSession } from '../middleware/auth.js';
import { audit } from '../services/audit.js';
import { HttpError, asyncHandler } from '../utils/http.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please wait a few minutes and try again' },
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(200),
  password: z.string().min(1, 'Enter your password').max(200),
});

const INVALID = 'Incorrect email or password';

router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await User.findOne({ email }).select('+passwordHash +failedLogins +lockUntil');

    if (!user || !user.active) {
      await audit(req, 'auth.login_failed', { summary: 'Unknown or inactive account', meta: { email } });
      throw new HttpError(401, INVALID);
    }
    if (user.isLocked()) {
      await audit({ user, ip: req.ip }, 'auth.login_blocked', { entityType: 'user', entityId: user._id, summary: 'Account temporarily locked' });
      throw new HttpError(423, 'Account temporarily locked after repeated failed attempts. Try again in 15 minutes');
    }
    if (!(await user.checkPassword(password))) {
      await user.registerFailedLogin();
      await audit({ user, ip: req.ip }, 'auth.login_failed', { entityType: 'user', entityId: user._id, summary: 'Wrong password' });
      throw new HttpError(401, INVALID);
    }

    user.failedLogins = 0;
    user.lockUntil = undefined;
    user.lastLoginAt = new Date();
    await user.save();

    res.cookie(SESSION_COOKIE, signSession(user), sessionCookieOptions());
    req.user = user;
    await audit(req, 'auth.login', { entityType: 'user', entityId: user._id, summary: 'Signed in' });
    res.json({ user: user.toSafeJSON() });
  }),
);

router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    // Bumping tokenVersion revokes every outstanding session token for this user.
    req.user.tokenVersion += 1;
    await req.user.save();
    await audit(req, 'auth.logout', { entityType: 'user', entityId: req.user._id, summary: 'Signed out' });
    res.clearCookie(SESSION_COOKIE, { ...sessionCookieOptions(), maxAge: undefined });
    res.json({ ok: true });
  }),
);

router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user.toSafeJSON() });
});

export default router;
