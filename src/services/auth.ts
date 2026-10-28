export type Credentials = { email: string; password: string };

export interface AuthProvider {
  signIn(credentials: Credentials): Promise<void>;
  signUp(credentials: Credentials): Promise<void>;
  resetPassword(email: string): Promise<void>;
}

export const AUTH_NOT_CONFIGURED =
  "Authentication is not connected yet. No request was sent.";

// Return a real SDK/backend adapter here when authentication is configured.
// The adapter must handle real responses and session storage, never simulate login.
export function getAuthProvider(): AuthProvider | null {
  return null;
}
