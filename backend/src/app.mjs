import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes, randomInt, randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import { transaction } from './database.mjs';
import { createResetDelivery } from './mail.mjs';
import { createIdentityVerifier } from './identity.mjs';

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new ApiError(status, message); };
const now = () => Date.now();
const RESET_MS = 10 * 60 * 1000;
const publicUser = user => ({ id: user.id, email: user.email, name: user.name, createdAt: user.created_at });
const emailOf = body => typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
function checkEmail(email) {
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.includes('..')) fail(400, 'Please enter a valid email address.');
}
function checkPassword(password) {
  if (typeof password !== 'string' || password.length < 8 || !password.trim()) fail(400, 'Use a password with at least 8 characters.');
  if (Buffer.byteLength(password, 'utf8') > 72) fail(400, 'Password must be at most 72 UTF-8 bytes.');
}

export function createApp({ config, db, deliverResetCode = createResetDelivery(config), verifyIdentity = createIdentityVerifier(config) }) {
  const app = express();
  const hash = value => createHmac('sha256', config.secret).update(value).digest('hex');
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: (origin, callback) => callback(null, !origin || config.corsOrigins.includes(origin)) }));
  app.use(express.json({ limit: '16kb' }));
  app.use('/auth', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  const limiter = (limit, windowMs, extra = {}) => rateLimit({ limit, windowMs, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { message: 'Too many attempts. Please wait and try again.' }, ...extra });
  app.use('/auth', limiter(100, 15 * 60 * 1000));
  const loginLimit = limiter(20, 15 * 60 * 1000);
  const resetLimit = limiter(5, 60 * 60 * 1000);
  // Per-address limit complements IP limits without retaining raw emails in memory.
  const emailLimit = limiter(5, 60 * 60 * 1000, { keyGenerator: req => hash(emailOf(req.body)) });
  const verifyLimit = limiter(15, 15 * 60 * 1000);
  // A dummy hash gives missing users the same bcrypt work as an incorrect password.
  const dummyHash = bcrypt.hashSync(randomBytes(32).toString('hex'), 12);

  function createSession(user) {
    const id = randomUUID();
    const expiresAt = (Math.floor(now() / 1000) + config.sessionSeconds) * 1000;
    const token = jwt.sign({}, config.secret, { algorithm: 'HS256', subject: user.id, jwtid: id,
      issuer: 'rnapp-auth', audience: 'rnapp-mobile', expiresIn: config.sessionSeconds });
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now());
    db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(id, user.id, expiresAt);
    return { token, expiresAt, user: publicUser(user) };
  }
  function requireAuth(req, _res, next) {
    try {
      const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
      if (!token) fail(401, 'Please log in to continue.');
      const payload = jwt.verify(token, config.secret, { algorithms: ['HS256'], issuer: 'rnapp-auth', audience: 'rnapp-mobile' });
      const user = db.prepare(`SELECT u.* FROM users u JOIN sessions s ON u.id = s.user_id
        WHERE s.id = ? AND u.id = ? AND s.expires_at > ?`).get(payload.jti, payload.sub, now());
      if (!user) fail(401, 'Your session has expired. Please log in again.');
      req.auth = { user, sessionId: payload.jti };
      next();
    } catch { next(new ApiError(401, 'Your session has expired. Please log in again.')); }
  }
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.post('/auth/register', loginLimit, async (req, res) => {
    const email = emailOf(req.body);
    checkEmail(email); checkPassword(req.body?.password);
    const passwordHash = await bcrypt.hash(req.body.password, 12);
    const id = randomUUID();
    try { db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(id, email, passwordHash); }
    catch (error) {
      if (error.code?.startsWith('ERR_SQLITE') && db.prepare('SELECT id FROM users WHERE email = ? AND password_hash IS NOT NULL').get(email)) {
        fail(409, 'An account with this email already exists. Please log in.');
      }
      throw error;
    }
    res.status(201).json({ message: 'Account created. You can now log in.' });
  });
  app.post('/auth/login', loginLimit, async (req, res) => {
    const email = emailOf(req.body);
    checkEmail(email);
    const password = req.body?.password;
    if (typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > 72) fail(400, 'Please enter a valid password.');
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND password_hash IS NOT NULL').get(email);
    const correct = await bcrypt.compare(password, user?.password_hash || dummyHash);
    if (!correct || !user) fail(401, 'Email or password is incorrect. Please try again.');
    // A concurrent reset must not create a session from the old password.
    if (db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id)?.password_hash !== user.password_hash) fail(401, 'Please log in with your new password.');
    res.json(createSession(user));
  });
  app.get('/auth/me', requireAuth, (req, res) => res.json({ user: publicUser(req.auth.user) }));
  app.post('/auth/logout', requireAuth, (req, res) => {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(req.auth.sessionId);
    res.json({ message: 'Logged out.' });
  });
  app.post('/auth/forgot-password', resetLimit, emailLimit, async (req, res) => {
    const email = emailOf(req.body); checkEmail(email);
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND password_hash IS NOT NULL').get(email);
    const dev = !config.smtp && config.devLogResetCodes && !config.production;
    const message = dev
      ? 'Development mode: if this email has a password account, a code appears in the backend terminal. No email was sent.'
      : 'If this email has a password account, you will receive a verification code shortly.';
    if (user) {
      const previous = db.prepare('SELECT requested_at FROM password_resets WHERE user_id = ?').get(user.id);
      if (!previous || previous.requested_at <= now() - 60000) {
        const code = randomInt(0, 1000000).toString().padStart(6, '0');
        const codeHash = hash(`${user.id}:${code}`);
        db.prepare(`INSERT INTO password_resets (user_id, code_hash, grant_hash, expires_at, attempts, requested_at)
          VALUES (?, ?, NULL, ?, 0, ?) ON CONFLICT(user_id) DO UPDATE SET code_hash=excluded.code_hash,
          grant_hash=NULL, expires_at=excluded.expires_at, attempts=0, requested_at=excluded.requested_at`)
          .run(user.id, codeHash, now() + RESET_MS, now());
        // Queue delivery so the public response does not reveal account existence through SMTP latency.
        Promise.resolve().then(() => deliverResetCode(email, code)).catch(() => {
          db.prepare('DELETE FROM password_resets WHERE user_id = ? AND code_hash = ?').run(user.id, codeHash);
          console.error('Password reset delivery failed. Check SMTP configuration.');
        });
      }
    }
    res.json({ message });
  });
  app.post('/auth/verify-code', verifyLimit, (req, res) => {
    const email = emailOf(req.body); checkEmail(email);
    const code = req.body?.code;
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) fail(400, 'Enter the six-digit verification code.');
    const reset = db.prepare(`SELECT r.* FROM password_resets r JOIN users u ON u.id = r.user_id WHERE u.email = ? AND u.password_hash IS NOT NULL`).get(email);
    const invalid = 'This code is invalid or expired. Request a new code and try again.';
    if (!reset?.code_hash || reset.expires_at <= now() || reset.attempts >= 5) fail(400, invalid);
    db.prepare('UPDATE password_resets SET attempts = attempts + 1 WHERE user_id = ?').run(reset.user_id);
    if (!timingSafeEqual(Buffer.from(reset.code_hash, 'hex'), Buffer.from(hash(`${reset.user_id}:${code}`), 'hex'))) fail(400, invalid);
    const resetToken = randomBytes(32).toString('hex');
    db.prepare('UPDATE password_resets SET code_hash = NULL, grant_hash = ? WHERE user_id = ?').run(hash(resetToken), reset.user_id);
    res.json({ resetToken, expiresAt: reset.expires_at });
  });
  app.post('/auth/reset-password', verifyLimit, async (req, res) => {
    checkPassword(req.body?.password);
    const resetToken = req.body?.resetToken;
    if (typeof resetToken !== 'string' || !/^[a-f0-9]{64}$/.test(resetToken)) fail(400, 'Verify a new code before resetting your password.');
    const grantHash = hash(resetToken);
    const reset = db.prepare('SELECT * FROM password_resets WHERE grant_hash = ? AND expires_at > ?').get(grantHash, now());
    if (!reset) fail(400, 'Your reset has expired or was already used. Request a new code.');
    const passwordHash = await bcrypt.hash(req.body.password, 12);
    transaction(db, () => {
      const claimed = db.prepare('DELETE FROM password_resets WHERE grant_hash = ? AND expires_at > ? RETURNING user_id').get(grantHash, now());
      if (!claimed) fail(400, 'Your reset has expired or was already used. Request a new code.');
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, claimed.user_id);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(claimed.user_id);
    });
    res.json({ message: 'Password updated. Please log in with your new password.' });
  });
  app.post('/auth/social/challenge', loginLimit, (req, res) => {
    const provider = req.body?.provider;
    if (!['google', 'facebook'].includes(provider)) fail(400, 'Choose Google or Facebook.');
    const nonce = randomBytes(32).toString('hex');
    db.prepare('DELETE FROM oauth_challenges WHERE expires_at <= ?').run(now());
    db.prepare('INSERT INTO oauth_challenges (hash, provider, expires_at) VALUES (?, ?, ?)').run(hash(nonce), provider, now() + RESET_MS);
    res.json({ nonce });
  });
  for (const provider of ['google', 'facebook']) {
    app.post(`/auth/${provider}`, loginLimit, async (req, res) => {
      const enabled = provider === 'google' ? config.googleClientId : config.facebookAppId && config.facebookAppSecret;
      if (!enabled) fail(503, `${provider === 'google' ? 'Google' : 'Facebook'} sign-in needs server configuration. See docs/authentication.md.`);
      const { token, nonce, limited } = req.body || {};
      if (typeof token !== 'string' || !token || token.length > 12000 || typeof nonce !== 'string' || !/^[a-f0-9]{64}$/.test(nonce) || (limited !== undefined && typeof limited !== 'boolean')) fail(400, 'Invalid sign-in response. Please try again.');
      const challenge = db.prepare('DELETE FROM oauth_challenges WHERE hash = ? AND provider = ? AND expires_at > ? RETURNING hash').get(hash(nonce), provider, now());
      if (!challenge) fail(401, 'Sign-in expired. Please try again.');
      let identity;
      try { identity = await verifyIdentity(provider, { token, nonce, limited }); }
      catch { fail(401, 'Unable to verify your social sign-in. Please try again.'); }
      const user = transaction(db, () => {
        const existing = db.prepare(`SELECT u.* FROM users u JOIN identities i ON u.id = i.user_id WHERE i.provider = ? AND i.provider_user_id = ?`).get(provider, identity.id);
        if (existing) return existing;
        // Provider ID is the identity. Matching emails never merge accounts.
        const id = randomUUID();
        db.prepare('INSERT INTO users (id, email, name) VALUES (?, ?, ?)').run(id, identity.email || null, identity.name || null);
        db.prepare('INSERT INTO identities (provider, provider_user_id, user_id) VALUES (?, ?, ?)').run(provider, identity.id, id);
        return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      });
      res.json(createSession(user));
    });
  }
  app.use((_req, _res, next) => next(new ApiError(404, 'Endpoint not found.')));
  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed') return res.status(400).json({ message: 'Send valid JSON.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ message: 'Request is too large.' });
    if (!(error instanceof ApiError)) console.error('Authentication API error:', error.code || error.name);
    res.status(error.status || 500).json({ message: error instanceof ApiError ? error.message : 'Something went wrong. Please try again.' });
  });
  return app;
}
