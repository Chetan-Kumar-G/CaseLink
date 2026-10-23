import { env } from '../config/env.js';

async function call(path, { method = 'GET', body, timeoutMs = env.aiTimeoutMs } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${env.aiServiceUrl}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(env.aiServiceKey ? { 'x-service-key': env.aiServiceKey } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`AI service responded ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function aiHealth() {
  try {
    const data = await call('/health', { timeoutMs: 2000 });
    return { reachable: true, ...data };
  } catch {
    return { reachable: false };
  }
}

// ClosureGuard adequacy check. Returns null when the AI service is unavailable.
export async function closureCheck({ complaint, response, evidence, receivedOn }) {
  try {
    return await call('/closure-check', { method: 'POST', body: { complaint, response, evidence, received_on: receivedOn } });
  } catch (err) {
    console.warn('[ai] ClosureGuard unavailable:', err.message);
    return null;
  }
}

// Returns null when the service is unavailable so callers can record that the
// semantic layer did not run, instead of silently reporting "no overlaps".
export async function semanticSimilarity(query, candidates) {
  if (!candidates.length) return { results: [], threshold: 1, mode: 'none' };
  try {
    return await call('/similarity', { method: 'POST', body: { query, candidates } });
  } catch (err) {
    console.warn('[ai] semantic layer unavailable:', err.message);
    return null;
  }
}
