import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.mjs';
import { openDatabase } from '../src/database.mjs';
import { readConfig } from '../src/config.mjs';

async function fixture(t) {
  const db = openDatabase(':memory:');
  const codes = [];
  const config = { secret: 'test-only-secret-with-more-than-32-characters', sessionSeconds: 3600,
    corsOrigins: ['http://localhost:8081'], devLogResetCodes: true, production: false,
    googleClientId: 'test-client', facebookAppId: 'test-app', facebookAppSecret: 'test-secret' };
  const app = createApp({ config, db,
    deliverResetCode: async (email, code) => { codes.push({ email, code }); },
    // Only the external provider boundary is stubbed. No bypass exists in server.mjs.
    verifyIdentity: async (provider, { token }) => {
      if (token !== 'verified-by-provider') throw new Error('Bad provider token');
      return { id: `${provider}-123`, email: 'person@example.com', name: 'Test Person' };
    },
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); db.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (route, body, token) => {
    const response = await fetch(`${base}${route}`, { method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  };
  const credentials = { email: 'person@example.com', password: 'original-password' };
  const register = () => request('/auth/register', credentials);
  const login = () => request('/auth/login', credentials);
  return { db, codes, request, credentials, register, login };
}

test('registration normalizes email, hashes passwords, rejects duplicates and validates input', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('/auth/register', { email: 'bad', password: 'original-password' })).status, 400);
  assert.equal((await f.request('/auth/register', { ...f.credentials, password: 'short' })).status, 400);
  assert.equal((await f.request('/auth/register', { ...f.credentials, password: '😀'.repeat(19) })).status, 400);
  assert.equal((await f.request('/auth/register', { ...f.credentials, email: '  PERSON@example.com ' })).status, 201);
  const user = f.db.prepare('SELECT * FROM users').get();
  assert.equal(user.email, f.credentials.email);
  assert.notEqual(user.password_hash, f.credentials.password);
  assert.ok(await bcrypt.compare(f.credentials.password, user.password_hash));
  assert.ok(user.created_at);
  assert.equal((await f.register()).status, 409);
});

test('login, protected user lookup, invalid credentials, expiration and logout revocation', async t => {
  const f = await fixture(t); await f.register();
  assert.equal((await f.request('/auth/me')).status, 401);
  assert.equal((await f.request('/auth/me', undefined, 'forged')).status, 401);
  assert.equal((await f.request('/auth/login', { ...f.credentials, password: 'wrong' })).status, 401);
  assert.equal((await f.request('/auth/login', { ...f.credentials, email: 'missing@example.com' })).status, 401);
  const { body: session, status } = await f.login();
  assert.equal(status, 200); assert.ok(session.expiresAt > Date.now());
  assert.equal(session.user.password_hash, undefined);
  assert.equal((await f.request('/auth/me', undefined, session.token)).body.user.id, session.user.id);
  assert.equal((await f.request('/auth/logout', {}, session.token)).status, 200);
  assert.equal((await f.request('/auth/me', undefined, session.token)).status, 401);
  const second = (await f.login()).body;
  f.db.prepare('UPDATE sessions SET expires_at = 0').run();
  assert.equal((await f.request('/auth/me', undefined, second.token)).status, 401);
});

test('reset is private, one-time, hashed, and revokes all prior sessions', async t => {
  const f = await fixture(t); await f.register();
  const session = (await f.login()).body;
  const known = await f.request('/auth/forgot-password', { email: f.credentials.email });
  const unknown = await f.request('/auth/forgot-password', { email: 'unknown@example.com' });
  assert.deepEqual(known, unknown);
  assert.match(known.body.message, /No email was sent/);
  assert.equal(f.codes.length, 1);
  const code = f.codes[0].code;
  const row = f.db.prepare('SELECT * FROM password_resets').get();
  assert.notEqual(row.code_hash, code); assert.equal(row.code_hash.length, 64);
  assert.equal(known.body.code, undefined);
  const verified = await f.request('/auth/verify-code', { email: f.credentials.email, code });
  assert.equal(verified.status, 200);
  assert.equal((await f.request('/auth/verify-code', { email: f.credentials.email, code })).status, 400);
  assert.notEqual(f.db.prepare('SELECT grant_hash FROM password_resets').get().grant_hash, verified.body.resetToken);
  const resetBody = { resetToken: verified.body.resetToken, password: 'updated-password' };
  assert.equal((await f.request('/auth/reset-password', resetBody)).status, 200);
  assert.equal((await f.request('/auth/reset-password', resetBody)).status, 400);
  assert.equal((await f.request('/auth/me', undefined, session.token)).status, 401);
  assert.equal((await f.login()).status, 401);
  assert.equal((await f.request('/auth/login', { ...f.credentials, password: 'updated-password' })).status, 200);
});

test('five incorrect reset codes exhaust retries, and expired codes and grants are rejected', async t => {
  const f = await fixture(t); await f.register();
  await f.request('/auth/forgot-password', { email: f.credentials.email });
  const code = f.codes[0].code;
  const wrong = code === '000000' ? '000001' : '000000';
  for (let i = 0; i < 5; i++) assert.equal((await f.request('/auth/verify-code', { email: f.credentials.email, code: wrong })).status, 400);
  assert.equal((await f.request('/auth/verify-code', { email: f.credentials.email, code })).status, 400);
  f.db.prepare('UPDATE password_resets SET attempts = 0, expires_at = 0').run();
  assert.equal((await f.request('/auth/verify-code', { email: f.credentials.email, code })).status, 400);
  f.db.prepare('UPDATE password_resets SET expires_at = ?').run(Date.now() + 60000);
  const verified = await f.request('/auth/verify-code', { email: f.credentials.email, code });
  assert.equal(verified.status, 200);
  f.db.prepare('UPDATE password_resets SET expires_at = 0').run();
  assert.equal((await f.request('/auth/reset-password', { resetToken: verified.body.resetToken, password: 'updated-password' })).status, 400);
});

test('reset requests are rate limited and a quick resend does not replace a code', async t => {
  const f = await fixture(t); await f.register();
  for (let i = 0; i < 5; i++) assert.equal((await f.request('/auth/forgot-password', { email: f.credentials.email })).status, 200);
  assert.equal(f.codes.length, 1);
  assert.equal((await f.request('/auth/forgot-password', { email: f.credentials.email })).status, 429);
});

test('social identities remain separate from a password account with the same email; nonce cannot be replayed', async t => {
  const f = await fixture(t); await f.register();
  const local = (await f.login()).body.user;
  for (const provider of ['google', 'facebook']) {
    const challenge = (await f.request('/auth/social/challenge', { provider })).body;
    const body = { token: 'verified-by-provider', nonce: challenge.nonce };
    const social = await f.request(`/auth/${provider}`, body);
    assert.equal(social.status, 200); assert.notEqual(social.body.user.id, local.id);
    assert.equal((await f.request(`/auth/${provider}`, body)).status, 401);
    const next = (await f.request('/auth/social/challenge', { provider })).body;
    assert.equal((await f.request(`/auth/${provider}`, { ...body, nonce: next.nonce })).body.user.id, social.body.user.id);
    const invalid = (await f.request('/auth/social/challenge', { provider })).body;
    assert.equal((await f.request(`/auth/${provider}`, { token: 'forged-token', nonce: invalid.nonce })).status, 401);
  }
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM users').get().n, 3);
});

test('SQLite users persist after reopening the database', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'rnapp-auth-test-'));
  const filename = path.join(directory, 'auth.sqlite');
  try {
    let db = openDatabase(filename);
    db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run('id', 'persist@example.com', 'hash-only');
    db.close(); db = openDatabase(filename);
    assert.equal(db.prepare('SELECT email FROM users').get().email, 'persist@example.com');
    db.close();
  } finally {
    const target = path.resolve(directory);
    assert.equal(path.dirname(target), path.resolve(tmpdir()));
    assert.ok(path.basename(target).startsWith('rnapp-auth-test-'));
    rmSync(target, { recursive: true, force: true });
  }
});

test('production refuses a weak secret or development-only reset delivery', () => {
  assert.throws(() => readConfig({ JWT_SECRET: 'weak' }), /JWT_SECRET/);
  assert.throws(() => readConfig({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(48), DEV_LOG_RESET_CODES: 'true' }), /SMTP/);
});
