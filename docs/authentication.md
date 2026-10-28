# Authentication status and phone checks

No authentication SDK, backend client, endpoint, or environment configuration was found in this project. Login, account creation, and password reset currently validate input and report that authentication is not connected. They never create a session or report a successful login.

## Connect a real provider later

Choose a hosted authentication service, such as Supabase Auth or Firebase Authentication, or an existing HTTPS backend. Set up email/password sign-in, account creation, password-reset email delivery, and the provider's password policy. Implement the `AuthProvider` interface in `src/services/auth.ts` using that provider's real SDK or API, and return the configured adapter from `getAuthProvider()`.

The adapter must handle provider responses, email verification, and secure session/token storage. A real authenticated destination and session-aware route protection are also needed before shipping sign-in. Passwords remain transient form state and must never be logged, persisted, included in navigation parameters, or embedded in source code. Client apps must never contain server-only secret keys.

`useAuthRequest` starts loading only after validation passes and a provider exists. During a real request, fields and submit/navigation buttons are disabled, duplicate submissions are blocked, and loading ends on both success and failure. No timer or fake request simulates authentication. With the current null provider, the spinner intentionally does not appear.

Google and Facebook show an explicit “not configured” message. Each needs its provider enabled, app/client identifiers, authorized redirect URLs, and the appropriate mobile OAuth flow before it can sign anyone in. No social authentication was added.

Expo setup guides: https://docs.expo.dev/guides/using-supabase/ and https://docs.expo.dev/guides/using-firebase/.

## Test on an Android phone

1. Open your existing development build and connect to this project's Expo server. If it is not running, use `npx expo start --dev-client`; keep the phone and computer on the same network. No native dependencies were added.
2. Press Login with both fields empty. An email error and a password error should appear directly below their inputs.
3. Type `not-an-email`, then press Login. The email field should request a valid email address.
4. Use a test address such as `person@example.com` and leave Password empty. Only the password field should show an error.
5. Enter any nonempty test password. Press Login or the keyboard's Done key. Expect “Authentication is not connected yet. No request was sent.” No successful login or session should appear.
6. Correct a field after submitting. Its validation error should update as you type. Email's Next key should focus Password; the password should stay masked.
7. Open Sign Up. Test its empty fields, then valid-looking test data. Expect the same honest configuration message. Use Back to Login or Android Back to return.
8. Open Forgot password. Test an empty/invalid email, then a valid-looking test email. No reset email should be claimed or sent until a real provider is connected.
9. Tap Google and Facebook. Each should explain that its sign-in provider is not configured.
10. With the keyboard open, scroll to both inputs and the submit button. Verify text is readable around the status bar, bottom navigation, and device safe area. Repeat on small and large screens if available.
11. After connecting a real provider, test loading and duplicate-tap prevention on a slow connection, invalid credentials, network failure, and real sign-in/session behavior. Never use production credentials for UI checks.

## Automated checks

```sh
npm run lint
npx tsc --noEmit
node --test tests/auth-validation.test.mjs
```

The Node tests use built-in TypeScript stripping (Node 22.18+ or Node 24+). They check local validation and the absence of a configured provider; they do not prove that a user owns an email address or can authenticate.

The reference `assets/login-reference.png` is still absent. Existing orange, white, gray, and peach styling has been preserved, but an exact visual match cannot be verified.
