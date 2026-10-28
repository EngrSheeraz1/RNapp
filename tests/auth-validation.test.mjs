import assert from "node:assert/strict";
import test from "node:test";

import { validateCredentials, validateEmail } from "../src/utils/auth-validation.ts";
import { AUTH_NOT_CONFIGURED, getAuthProvider } from "../src/services/auth.ts";

test("empty email and password each get a field error", () => {
  const errors = validateCredentials("", "");
  assert.equal(errors.email, "Please enter your email address.");
  assert.equal(errors.password, "Please enter your password.");
});

test("whitespace-only fields cannot pass validation", () => {
  assert.ok(validateCredentials("  ", "  ").email);
  assert.ok(validateCredentials("  ", "  ").password);
});

for (const email of ["person", "person@", "@example.com", "person@example", "a@@example.com", "a b@example.com", "a@exam ple.com", "a@example..com", ".person@example.com", "person.@example.com", "a@-example.com", "a@example-.com", "a@example.c_m"]) {
  test(`rejects invalid email format: ${email}`, () => {
    assert.equal(validateEmail(email), "Please enter a valid email address.");
  });
}

for (const email of ["person@example.com", "person+tag@example.co.uk", "  Person@example.com  "]) {
  test(`accepts ordinary email format: ${email}`, () => {
    assert.equal(validateEmail(email), undefined);
  });
}

test("valid-looking email never bypasses the required password", () => {
  const errors = validateCredentials("person@example.com", "");
  assert.equal(errors.email, undefined);
  assert.ok(errors.password);
});

test("nonempty credentials pass local validation without authenticating", () => {
  assert.deepEqual(validateCredentials("person@example.com", "test-only-input"), {
    email: undefined,
    password: undefined,
  });
});

test("no real authentication provider is configured", () => {
  assert.equal(getAuthProvider(), null);
  assert.match(AUTH_NOT_CONFIGURED, /No request was sent/);
});
