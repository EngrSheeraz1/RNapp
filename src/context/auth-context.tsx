import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';

import { AuthError, authApi, onUnauthorized, type Credentials, type Session, type SocialProvider } from '@/services/auth';
import { clearSocialSessions, socialSignIn } from '@/services/social-auth';
import { createSessionStorage, parseStoredSession, SessionStorageError, storageFailureDetails } from '@/services/session-storage';

type ResetFlow = { email: string; message: string; resetToken?: string; expiresAt?: number };
export type AuthActions = {
  signIn(credentials: Credentials): Promise<void>;
  signUp(credentials: Credentials): Promise<void>;
  signInSocial(provider: SocialProvider): Promise<void>;
  requestReset(email: string): Promise<void>;
  verifyCode(code: string): Promise<void>;
  resetPassword(password: string): Promise<void>;
};
type AuthContextValue = AuthActions & {
  session: Session | null; checking: boolean; startupError: string; resetFlow: ResetFlow | null;
  storageUnavailable: boolean;
  retrySession(): Promise<void>; signOut(): Promise<void>; testSecureStorage(): Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);
const nativeStorage = createSessionStorage(
  // Import failures are handled during session loading, not while Router discovers screens.
  () => import('expo-secure-store'),
  error => { if (__DEV__) console.warn('[Secure session storage]', storageFailureDetails(error)); },
);
// Web has no SecureStore: keep its session in memory only.
const storage = Platform.OS === 'web' ? {
  read: async () => null,
  write: async (_value: string) => {},
  clear: async () => {},
  probe: async () => { throw new AuthError('Secure storage diagnostics require an Android or iOS app.'); },
} : nativeStorage;

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const currentSession = useRef<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [startupError, setStartupError] = useState('');
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [resetFlow, setResetFlow] = useState<ResetFlow | null>(null);
  const generation = useRef(0);
  const clearing = useRef<Promise<void> | null>(null);

  const reportStartupFailure = useCallback((error: unknown, fallback: string) => {
    setStartupError(error instanceof SessionStorageError || error instanceof AuthError ? error.message : fallback);
    setStorageUnavailable(error instanceof SessionStorageError && error.kind === 'unavailable');
  }, []);

  const clearSession = useCallback((): Promise<void> => {
    if (clearing.current) return clearing.current;
    const version = ++generation.current;
    const task = (async () => {
      // Block protected content immediately; do not enter Login until deletion is confirmed.
      setChecking(true);
      currentSession.current = null;
      setSession(null); setResetFlow(null);
      try {
        await storage.clear();
        if (version === generation.current) { setStartupError(''); setStorageUnavailable(false); }
      } catch (error) {
        if (version === generation.current) reportStartupFailure(error, 'The saved session could not be removed securely. Please retry.');
        throw error;
      } finally {
        if (version === generation.current) setChecking(false);
      }
    })();
    clearing.current = task;
    const finished = () => { if (clearing.current === task) clearing.current = null; };
    void task.then(finished, finished);
    return task;
  }, [reportStartupFailure]);

  const restoreSession = useCallback(async () => {
    const version = ++generation.current;
    setChecking(true); setStartupError(''); setStorageUnavailable(false);
    async function discardInvalidSession() {
      await storage.clear();
      if (version === generation.current) {
        currentSession.current = null;
        setSession(null); setResetFlow(null);
      }
    }
    try {
      const raw = await storage.read();
      if (raw === null) {
        if (version === generation.current) { currentSession.current = null; setSession(null); }
        return;
      }
      const saved = parseStoredSession(raw);
      if (!saved) {
        await discardInvalidSession(); return;
      }
      const { user } = await authApi.me(saved.token);
      if (version === generation.current) {
        currentSession.current = { ...saved, user };
        setSession(currentSession.current);
      }
    } catch (error) {
      if (version !== generation.current) return;
      if (error instanceof AuthError && error.status === 401) {
        try { await clearSession(); } catch { /* clearSession displays a recoverable storage error. */ }
      }
      else reportStartupFailure(error, 'Unable to read your secure session. Please try again.');
    } finally { if (version === generation.current) setChecking(false); }
  }, [clearSession, reportStartupFailure]);

  useEffect(() => {
    onUnauthorized(token => {
      if (currentSession.current?.token === token) void clearSession().catch(() => { /* clearSession reports the precise storage failure. */ });
    });
    void restoreSession();
    return () => onUnauthorized(undefined);
  }, [clearSession, restoreSession]);

  useEffect(() => {
    if (!session) return;
    const expire = () => void clearSession().catch(() => { /* clearSession keeps failed recovery visible. */ });
    let timer: ReturnType<typeof setTimeout>;
    const scheduleExpiry = () => {
      const remaining = session.expiresAt - Date.now();
      if (remaining <= 0) expire();
      else timer = setTimeout(scheduleExpiry, Math.min(remaining, 2147483647));
    };
    scheduleExpiry();
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      if (session.expiresAt <= Date.now()) { expire(); return; }
      void authApi.me(session.token).catch(() => { /* 401 clears the session; transient network loss keeps the active session. */ });
    });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [session, clearSession]);

  async function acceptSession(result: Session) {
    try { await storage.write(JSON.stringify({ token: result.token, expiresAt: result.expiresAt })); }
    catch (error) {
      void authApi.logout(result.token).catch(() => {});
      reportStartupFailure(error, 'Could not save your session securely. Please try again.');
      throw new AuthError(error instanceof SessionStorageError ? error.message : 'Could not save your session securely. Please try again.');
    }
    generation.current++;
    currentSession.current = result;
    setSession(result); setResetFlow(null);
  }

  async function signOut() {
    const token = currentSession.current?.token;
    await clearSession();
    setStartupError('');
    if (token) void authApi.logout(token).catch(() => {});
    void clearSocialSessions();
  }

  const value: AuthContextValue = {
    session, checking, startupError, storageUnavailable, resetFlow, retrySession: restoreSession, signOut,
    testSecureStorage: storage.probe,
    signIn: async credentials => acceptSession(await authApi.signIn(credentials)),
    signUp: authApi.signUp,
    signInSocial: async provider => acceptSession(await socialSignIn(provider)),
    requestReset: async email => {
      const { message } = await authApi.requestReset(email);
      setResetFlow({ email: email.trim().toLowerCase(), message });
    },
    verifyCode: async code => {
      if (!resetFlow) throw new AuthError('Request a new verification code first.');
      const grant = await authApi.verifyCode(resetFlow.email, code);
      setResetFlow({ ...resetFlow, ...grant });
    },
    resetPassword: async password => {
      if (!resetFlow?.resetToken || !resetFlow.expiresAt || resetFlow.expiresAt <= Date.now()) throw new AuthError('Your reset has expired. Request a new verification code.');
      await authApi.resetPassword(resetFlow.resetToken, password);
      setResetFlow(null);
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth requires AuthProvider.');
  return value;
}
