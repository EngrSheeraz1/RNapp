import { useRef, useState } from "react";

import { useAuth, type AuthActions } from "@/context/auth-context";
import { AuthError } from "@/services/auth";
import { SignInCancelled } from "@/services/social-auth";

export function useAuthRequest() {
  const provider = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  async function runRequest(
    request: (provider: AuthActions) => Promise<unknown>,
    failureMessage: string,
  ): Promise<boolean> {
    if (inFlight.current) return false;
    setError("");

    inFlight.current = true;
    setIsLoading(true);
    try {
      await request(provider);
      return true;
    } catch (error) {
      if (!(error instanceof SignInCancelled)) setError(error instanceof AuthError ? error.message : failureMessage);
      return false;
    } finally {
      inFlight.current = false;
      setIsLoading(false);
    }
  }

  return { isLoading, error, clearError: () => setError(""), runRequest };
}
