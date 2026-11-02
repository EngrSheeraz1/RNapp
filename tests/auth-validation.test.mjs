import assert from "node:assert/strict";
import test from "node:test";

import { validateCredentials, validateEmail, validateNewPassword } from "../src/utils/auth-validation.ts";

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

test('new passwords enforce minimum length and bcrypt byte limit', () => {
  assert.ok(validateNewPassword('short'));
  assert.ok(validateNewPassword(' '.repeat(8)));
  assert.equal(validateNewPassword('correct horse battery'), undefined);
  assert.equal(validateNewPassword('a'.repeat(72)), undefined);
  assert.ok(validateNewPassword('a'.repeat(73)));
  assert.equal(validateNewPassword('😀'.repeat(18)), undefined);
  assert.ok(validateNewPassword('😀'.repeat(19)));
});
