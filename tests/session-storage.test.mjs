import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionStorage, parseStoredSession, SessionStorageError, storageFailureDetails } from '../src/services/session-storage.ts';

const SESSION_KEY = 'rnapp.auth.session.v1';

test('malformed, expired, and empty-token session records are rejected', () => {
  for (const raw of ['bad JSON', 'null', '{}', '[]', '{"token":"","expiresAt":200}',
    '{"token":"   ","expiresAt":200}', '{"token":"test","expiresAt":100}', '{"token":"test","expiresAt":"200"}']) {
    assert.equal(parseStoredSession(raw, 100), null);
  }
  assert.deepEqual(parseStoredSession('{"token":"test","expiresAt":200}', 100), { token: 'test', expiresAt: 200 });
});
function fixture(overrides = {}) {
  const values = new Map();
  const calls = [];
  const failures = [];
  const api = {
    isAvailableAsync: async () => true,
    getItemAsync: async key => { calls.push(['read', key]); return values.get(key) ?? null; },
    setItemAsync: async (key, value) => { calls.push(['write', key]); values.set(key, value); },
    deleteItemAsync: async key => { calls.push(['delete', key]); values.delete(key); },
    ...overrides,
  };
  return { values, calls, failures, api, storage: createSessionStorage(async () => api, error => failures.push(error)) };
}

test('missing session reads as null without attempting a delete', async () => {
  const f = fixture();
  assert.equal(await f.storage.read(), null);
  assert.deepEqual(f.calls, [['read', SESSION_KEY]]);
});

test('session write/read and confirmed deletion preserve the existing key', async () => {
  const f = fixture();
  await f.storage.write('test-session-payload');
  assert.equal(await f.storage.read(), 'test-session-payload');
  await f.storage.clear();
  assert.equal(await f.storage.read(), null);
  await f.storage.clear(); // Already-absent sessions can be cleared safely.
  assert.equal(f.failures.length, 0);
});

test('missing native module keeps its original cause and never pretends clear succeeded', async () => {
  const cause = new Error("Cannot find native module 'ExpoSecureStore'");
  const failures = [];
  const storage = createSessionStorage(async () => { throw cause; }, error => failures.push(error));
  await assert.rejects(storage.clear(), error => {
    assert.ok(error instanceof SessionStorageError);
    assert.equal(error.kind, 'unavailable'); assert.equal(error.operation, 'delete');
    assert.equal(error.cause, cause);
    assert.equal(storageFailureDetails(error).reason, 'missing-native-module');
    return true;
  });
  assert.equal(failures.length, 1);
});

test('unavailable or incomplete SecureStore API is detected before data operations', async () => {
  const f = fixture({ isAvailableAsync: async () => false });
  await assert.rejects(f.storage.read(), error => error.kind === 'unavailable');
  assert.deepEqual(f.calls, []);
  const storage = createSessionStorage(async () => ({}));
  await assert.rejects(storage.read(), error => error.kind === 'unavailable');
});

test('Keystore/decryption read exceptions remain distinct from native-module absence', async () => {
  const cause = Object.assign(new Error('KeyPermanentlyInvalidatedException'), { code: 'ERR_DECRYPT' });
  const f = fixture({ getItemAsync: async () => { throw cause; } });
  await assert.rejects(f.storage.read(), error => {
    assert.equal(error.kind, 'read'); assert.equal(error.cause, cause);
    assert.equal(storageFailureDetails(error).nativeCode, 'ERR_DECRYPT');
    assert.equal(storageFailureDetails(error).reason, 'invalidated-key');
    return true;
  });
  assert.equal(f.failures.length, 1);
});

test('deletion failure and read-after-delete failure identify their exact operations', async () => {
  const cause = Object.assign(new Error('Native preferences commit failed'), { code: 'ERR_DELETE' });
  const f = fixture({ deleteItemAsync: async () => { throw cause; } });
  await assert.rejects(f.storage.clear(), error => error.kind === 'delete' && error.operation === 'delete' && error.cause === cause);
  const confirmation = fixture({ getItemAsync: async () => { throw new Error('Read failed'); } });
  await assert.rejects(confirmation.storage.clear(), error => error.kind === 'delete' && error.operation === 'verify-delete');
  const retained = fixture({ deleteItemAsync: async () => {} });
  retained.values.set(SESSION_KEY, 'still-present');
  await assert.rejects(retained.storage.clear(), error => error.kind === 'delete' && error.operation === 'verify-delete');
});

test('probe tests an independent temporary key, cleans it up and never touches the session', async () => {
  const f = fixture();
  f.values.set(SESSION_KEY, 'private-existing-session');
  await f.storage.probe();
  assert.equal(f.values.get(SESSION_KEY), 'private-existing-session');
  assert.equal(f.values.size, 1);
  assert.ok(f.calls.every(([, key]) => key.startsWith('rnapp.auth.probe.')));
  assert.deepEqual(f.calls.map(([operation]) => operation), ['read', 'write', 'read', 'delete', 'read']);
});

test('probe cleans up a partially written key even if write rejects', async () => {
  const f = fixture();
  f.api.setItemAsync = async (key, value) => { f.values.set(key, value); throw new Error('Write confirmation failed'); };
  await assert.rejects(f.storage.probe(), error => error.kind === 'probe' && error.operation === 'write');
  assert.equal(f.values.size, 0);
});

test('probe reports cleanup failure rather than claiming that the check passed', async () => {
  const f = fixture({ deleteItemAsync: async () => { throw new Error('Cannot delete temporary key'); } });
  await assert.rejects(f.storage.probe(), error => error.kind === 'probe' && error.operation === 'delete');
  assert.equal(f.failures.length, 1);
});

test('automatic error summaries never include values or raw native messages', () => {
  const error = new SessionStorageError('write', 'write', new Error('sensitive-session-value'));
  const details = JSON.stringify(storageFailureDetails(error));
  assert.ok(!details.includes('sensitive-session-value'));
  assert.ok(!error.message.includes('sensitive-session-value'));
});
