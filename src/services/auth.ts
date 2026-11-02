export type Credentials = { email: string; password: string };
export type User = { id: string; email: string | null; name: string | null; createdAt: string };
export type Session = { token: string; expiresAt: number; user: User };
export type SocialProvider = 'google' | 'facebook';

export class AuthError extends Error {
  constructor(message: string, public status = 0) { super(message); }
}

// Expo substitutes direct EXPO_PUBLIC_* references at bundle time. No server secrets belong here.
export const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') || '';
let unauthorized: ((token: string) => void) | undefined;
export function onUnauthorized(handler: typeof unauthorized) { unauthorized = handler; }

export async function apiRequest<T>(path: string, body?: unknown, token?: string, method?: string): Promise<T> {
  if (!API_URL) throw new AuthError('Set EXPO_PUBLIC_API_URL to your computer’s LAN address in .env.local, then restart Expo.');
  if (!__DEV__ && !API_URL.startsWith('https://')) throw new AuthError('Release builds require an HTTPS API address.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: method || (body === undefined ? 'GET' : 'POST'),
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401 && token) unauthorized?.(token);
      throw new AuthError(typeof data.message === 'string' ? data.message : 'Unable to complete this request.', response.status);
    }
    return data as T;
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError('Cannot reach the server. Check Wi-Fi, your LAN API address, and that the backend is running.');
  } finally { clearTimeout(timer); }
}

export const authApi = {
  signIn: (credentials: Credentials) => apiRequest<Session>('/auth/login', credentials),
  signUp: async (credentials: Credentials) => { await apiRequest('/auth/register', credentials); },
  requestReset: (email: string) => apiRequest<{ message: string }>('/auth/forgot-password', { email }),
  verifyCode: (email: string, code: string) => apiRequest<{ resetToken: string; expiresAt: number }>('/auth/verify-code', { email, code }),
  resetPassword: async (resetToken: string, password: string) => { await apiRequest('/auth/reset-password', { resetToken, password }); },
  me: (token: string) => apiRequest<{ user: User }>('/auth/me', undefined, token),
  logout: (token: string) => apiRequest('/auth/logout', {}, token),
  challenge: (provider: SocialProvider) => apiRequest<{ nonce: string }>('/auth/social/challenge', { provider }),
  social: (provider: SocialProvider, token: string, nonce: string, limited = false) =>
    apiRequest<Session>(`/auth/${provider}`, { token, nonce, limited }),
};
