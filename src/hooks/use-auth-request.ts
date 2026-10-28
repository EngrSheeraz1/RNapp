import { useRef, useState } from "react";

import { AUTH_NOT_CONFIGURED, getAuthProvider, type AuthProvider } from "@/services/auth";

export function useAuthRequest() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  async function runRequest(
    request: (provider: AuthProvider) => Promise<void>,
    failureMessage: string,
  ): Promise<boolean> {
    if (inFlight.current) return false;
    setError("");

    const provider = getAuthProvider();
    if (!provider) {
      setError(AUTH_NOT_CONFIGURED);
      return false;
    }

    inFlight.current = true;
    setIsLoading(true);
    try {
      await request(provider);
      return true;
    } catch {
      // Do not expose raw provider errors, which may include sensitive details.
      setError(failureMessage);
      return false;
    } finally {
      inFlight.current = false;
      setIsLoading(false);
    }
  }

  return { isLoading, error, clearError: () => setError(""), runRequest };
}
