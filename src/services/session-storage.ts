export type StorageOperation = 'availability' | 'read' | 'write' | 'delete' | 'verify-delete' | 'probe';
export type StorageFailure = 'unavailable' | 'read' | 'write' | 'delete' | 'probe';

export interface SecureStorageApi {
  isAvailableAsync(): Promise<boolean>;
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export function parseStoredSession(raw: string, now = Date.now()): { token: string; expiresAt: number } | null {
  try {
    const saved = JSON.parse(raw);
    if (typeof saved?.token !== 'string' || !saved.token.trim() ||
      !Number.isFinite(saved.expiresAt) || saved.expiresAt <= now) return null;
    return { token: saved.token, expiresAt: saved.expiresAt };
  } catch { return null; }
}

const messages: Record<StorageFailure, string> = {
  unavailable: 'Secure session storage is unavailable in this app. Install a development build containing ExpoSecureStore, then reopen the app.',
  read: 'Your saved session could not be read securely. Retry, or clear the saved session to log in again.',
  write: 'Your session could not be saved securely. Please retry. You have not been signed in.',
  delete: 'The saved session could not be removed from secure storage. Please retry. Recovery has not completed.',
  probe: 'The secure storage test failed. Please retry after unlocking your phone.',
};

export class SessionStorageError extends Error {
  readonly kind: StorageFailure;
  readonly operation: StorageOperation;
  readonly cause: unknown;

  constructor(kind: StorageFailure, operation: StorageOperation, cause?: unknown, message = messages[kind]) {
    super(message);
    this.name = 'SessionStorageError';
    this.kind = kind;
    this.operation = operation;
    this.cause = cause;
  }
}

function unavailable(error: unknown) {
  return error instanceof Error && /Cannot find native module ['"]ExpoSecureStore['"]/.test(error.message);
}

// Never include values, tokens, or the raw native error message in automatic logs.
export function storageFailureDetails(error: SessionStorageError) {
  const cause = error.cause as { name?: unknown; code?: unknown; message?: unknown } | undefined;
  const safeLabel = (value: unknown) => typeof value === 'string' && /^[a-zA-Z0-9_]+$/.test(value) ? value : undefined;
  const text = typeof cause?.message === 'string' ? cause.message : '';
  const reason = unavailable(error.cause) ? 'missing-native-module'
    : error.kind === 'unavailable' ? 'native-api-unavailable'
    : /KeyPermanentlyInvalidated|permanently invalidated/i.test(text) ? 'invalidated-key'
    : /BadPadding|AEADBadTag|decrypt|keystore|key store/i.test(text) ? 'keystore-or-decryption'
    : 'storage-operation-failed';
  return { operation: error.operation, failure: error.kind,
    nativeName: safeLabel(cause?.name), nativeCode: safeLabel(cause?.code), reason };
}

export function createSessionStorage(
  loadApi: () => Promise<SecureStorageApi>,
  reportFailure: (error: SessionStorageError) => void = () => {},
) {
  const sessionKey = 'rnapp.auth.session.v1';
  let probeCounter = 0;

  async function run<T>(operation: StorageOperation, action: (api: SecureStorageApi) => Promise<T>): Promise<T> {
    try {
      const api = await loadApi();
      if (!api || ['isAvailableAsync', 'getItemAsync', 'setItemAsync', 'deleteItemAsync']
        .some(method => typeof api[method as keyof SecureStorageApi] !== 'function')) {
        throw new SessionStorageError('unavailable', 'availability');
      }
      if (!await api.isAvailableAsync()) throw new SessionStorageError('unavailable', 'availability');
      return await action(api);
    } catch (cause) {
      const error = cause instanceof SessionStorageError ? cause
        : new SessionStorageError(unavailable(cause) || operation === 'availability' ? 'unavailable'
          : operation === 'verify-delete' ? 'delete' : operation, operation, cause);
      reportFailure(error);
      throw error;
    }
  }

  return {
    read: () => run('read', api => api.getItemAsync(sessionKey)),
    write: (value: string) => run('write', api => api.setItemAsync(sessionKey, value)),
    clear: async () => {
      // Deleting a missing key is safe. Confirm removal before returning to Login.
      await run('delete', api => api.deleteItemAsync(sessionKey));
      await run('verify-delete', async api => {
        if (await api.getItemAsync(sessionKey) !== null) throw new Error('Secure session deletion was not confirmed.');
      });
    },
    probe: () => run('probe', async api => {
      // Independent, non-secret data. Never overwrite or read the authentication key here.
      const key = `rnapp.auth.probe.${Date.now().toString(36)}.${++probeCounter}.${Math.random().toString(36).slice(2)}`;
      const value = 'secure-storage-test';
      if (await api.getItemAsync(key) !== null) throw new Error('Temporary storage key already exists.');
      let primaryError: unknown;
      let stage: StorageOperation = 'write';
      try {
        await api.setItemAsync(key, value);
        stage = 'read';
        if (await api.getItemAsync(key) !== value) throw new Error('Temporary storage read-back did not match.');
      } catch (cause) {
        primaryError = new SessionStorageError('probe', stage, cause,
          `The secure storage test failed during ${stage}. No session data was changed.`);
      }
      try {
        await api.deleteItemAsync(key);
        if (await api.getItemAsync(key) !== null) throw new Error('Temporary storage deletion was not confirmed.');
      } catch (cause) {
        // Report cleanup failures even if the preceding write/read also failed.
        throw new SessionStorageError('probe', 'delete', primaryError
          ? new AggregateError([primaryError, cause], 'Storage probe and temporary-key cleanup failed.') : cause,
        'The temporary storage test key could not be removed. No saved session was changed.');
      }
      if (primaryError) throw primaryError;
    }),
  };
}
