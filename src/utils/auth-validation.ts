export type CredentialErrors = { email?: string; password?: string };

export function validateEmail(email: string): string | undefined {
  const value = email.trim();
  if (!value) return "Please enter your email address.";

  // A basic format check; the authentication provider must verify ownership.
  const [localPart, domain = ""] = value.split("@");
  const domainLabelsAreValid = domain.split(".").every((label) =>
    label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label));
  if (
    value.length > 254 ||
    localPart.length > 64 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ||
    value.includes("..") ||
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    !domainLabelsAreValid
  ) {
    return "Please enter a valid email address.";
  }
}

export function validateCredentials(email: string, password: string): CredentialErrors {
  return {
    email: validateEmail(email),
    password: password.trim() ? undefined : "Please enter your password.",
  };
}
