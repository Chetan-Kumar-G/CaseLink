import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { HttpError, asyncHandler } from '../utils/http.js';

export const SESSION_COOKIE = 'cl_session';
const ISSUER = 'caselink-api';

export function signSession(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role, tv: user.tokenVersion }, env.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: env.jwtExpiresIn,
    issuer: ISSUER,
  });
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'strict',
    path: '/api',
    maxAge: env.cookieMaxAgeMs,
  };
}

// Accepts the httpOnly session cookie (browser) or a Bearer token (API clients).
export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  const token = req.cookies?.[SESSION_COOKIE] || (header?.startsWith('Bearer ') ? header.slice(7) : null);
  if (!token) throw new HttpError(401, 'Please sign in to continue');

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'], issuer: ISSUER });
  } catch {
    throw new HttpError(401, 'Your session has expired. Please sign in again');
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.active || payload.tv !== user.tokenVersion) {
    throw new HttpError(401, 'Your session is no longer valid. Please sign in again');
  }
  req.user = user;
  next();
});

export const authorize =
  (...roles) =>
  (req, _res, next) =>
    roles.includes(req.user?.role)
      ? next()
      : next(new HttpError(403, 'You do not have permission to perform this action'));
