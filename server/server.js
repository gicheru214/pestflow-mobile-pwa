/**
 * PestFlow Revenue Accelerator Quiz — submission backend.
 *
 * Endpoints
 *   POST /api/quiz-submissions           — public; accepts a quiz submission
 *   GET  /api/quiz-submissions           — admin; lists submissions  (header: x-admin-token)
 *   GET  /admin                          — admin; serves dashboard HTML
 *   GET  /health                         — health check
 *
 * Storage
 *   Newline-delimited JSON at $DATA_DIR/submissions.ndjson  (default ./data)
 *   Append-only.  One submission per line so concurrent writes don't trash the file.
 *
 * Env
 *   PORT             default 8787
 *   DATA_DIR         default ./data
 *   ADMIN_TOKEN      required to read submissions and load /admin
 *   CORS_ORIGINS     comma-separated origin allowlist (default "*")
 */
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT          = Number(process.env.PORT || 8787);
const DATA_DIR      = process.env.DATA_DIR || path.join(__dirname, 'data');
const SUBMISSIONS   = path.join(DATA_DIR, 'submissions.ndjson');
const ADMIN_TOKEN   = process.env.ADMIN_TOKEN || 'dev-admin-token-change-me';
const CORS_ORIGINS  = (process.env.CORS_ORIGINS || '*')
  .split(',').map(s => s.trim()).filter(Boolean);

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(SUBMISSIONS)) fs.writeFileSync(SUBMISSIONS, '');

const app = express();
app.use(express.json({ limit: '64kb' }));

// ── CORS ──────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allow  = CORS_ORIGINS.includes('*') || (origin && CORS_ORIGINS.includes(origin));
  if (allow) {
    res.setHeader('Access-Control-Allow-Origin', CORS_ORIGINS.includes('*') ? '*' : origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(allow ? 204 : 403);
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.post('/api/quiz-submissions', (req, res) => {
  const body = req.body || {};
  // light schema check — the wireframe sends these fields
  const required = ['answers', 'revenue', 'score'];
  for (const k of required) {
    if (body[k] === undefined) return res.status(400).json({ error: `missing field: ${k}` });
  }
  const record = {
    id: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
    ip: (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim(),
    userAgent: (req.headers['user-agent'] || '').slice(0, 300),
    referer: (req.headers['referer'] || '').slice(0, 300),
    contact: body.contact ?? null,        // { name?, email?, phone?, business? }
    revenue: Number(body.revenue) || 0,
    score: Number(body.score) || 0,
    breakdown: body.breakdown ?? null,    // { retention, efficiency, leads }
    answers: body.answers,                // { 0: {val, customVal?, revealed}, ... }
    durationMs: Number(body.durationMs) || 0,
    pausedSteps: body.pausedSteps ?? null // optional engagement signal
  };
  fs.appendFileSync(SUBMISSIONS, JSON.stringify(record) + '\n');
  res.json({ ok: true, id: record.id });
});

function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (token !== ADMIN_TOKEN) return res.status(401).json({ error: 'unauthorized' });
  next();
}

app.get('/api/quiz-submissions', requireAdmin, (_req, res) => {
  const raw = fs.readFileSync(SUBMISSIONS, 'utf8');
  const rows = raw.split('\n').filter(Boolean).map(line => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
  rows.sort((a, b) => (b.receivedAt || '').localeCompare(a.receivedAt || ''));
  res.json({ count: rows.length, submissions: rows });
});

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.use('/admin/static', express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`[pestflow-quiz-backend] listening on :${PORT}`);
  console.log(`  DATA_DIR     = ${DATA_DIR}`);
  console.log(`  CORS_ORIGINS = ${CORS_ORIGINS.join(', ')}`);
  if (ADMIN_TOKEN === 'dev-admin-token-change-me') {
    console.warn('  WARNING: ADMIN_TOKEN is the default dev value. Set ADMIN_TOKEN env var in prod.');
  }
});
