import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http.js';

export function notFound(_req, _res, next) {
  next(new HttpError(404, 'Resource not found'));
}

 
export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Please check the highlighted fields',
      fields: Object.fromEntries(err.issues.map((i) => [i.path.join('.') || '_', i.message])),
    });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ error: 'Invalid identifier' });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ error: 'A record with these details already exists' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request is too large' });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...(err.details || {}) });
  }
  console.error('[error]', err);
  res.status(500).json({ error: 'Something went wrong on our side', ...(env.isProd ? {} : { debug: err.message }) });
}
