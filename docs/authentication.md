# Authentication setup and phone testing

The existing Expo SDK 54 / React Native 0.81 app now uses a local Express API and persistent SQLite database. The login design, orange button, fields, decorations, and social buttons are reused. Routes live only in `src/app`; the old `app/` compatibility wrappers were removed to avoid duplicate route trees. Restart Metro after this change.

## Feature status

| Feature | Status |
| --- | --- |
| Email/password signup and login | Implemented; backend integration tests pass |
| Confirm password, validation, loading, duplicate-submit prevention | Implemented |
| Accessible show/hide password icons | Implemented using existing Ionicons |
| Secure session persistence and startup verification | Implemented with expo-secure-store on native |
| Protected Home/About, expiry, logout | Implemented; sessions are also checked by the backend |
| Forgot password → code → new password | Implemented; codes expire after 10 minutes and allow five guesses |
| SMTP delivery | Implemented; requires your SMTP credentials |
| Development reset delivery | Enabled locally; backend terminal shows the code and explicitly says no email was sent |
| Google | Real native Credential Manager / iOS sign-in and backend token verification implemented; OAuth setup and rebuilt device testing remain |
| Facebook | Real native SDK and backend access-token verification implemented; Meta app setup and rebuilt device testing remain |

No Google, Meta, SMTP, or EAS account credentials were available. No external account was created and no fake social login is used. Android JavaScript export was checked; native compilation and physical-device UI/SDK tests still need your development build. On web, email authentication works with an in-memory session; native social login and SecureStore persistence are intentionally native-only.

## Install dependencies

Use Node.js 24 or newer (this backend uses built-in `node:sqlite`). The dependencies and lockfiles have already been installed here. To reproduce on another checkout:

```powershell
cd D:\RNapp
npm.cmd ci
npm.cmd --prefix backend ci
npm.cmd --prefix backend run setup
Copy-Item .env.example .env.local
```

Only copy `.env.example` when `.env.local` does not already exist. `backend` setup keeps an existing `.env`; on first run it generates a random JWT secret. Never copy that secret to the mobile app.

To add these packages again through Expo's installer:

```powershell
npx.cmd expo install expo-secure-store expo-build-properties react-native-nitro-google-signin react-native-nitro-modules react-native-fbsdk-next
npx.cmd expo install express cors helmet express-rate-limit bcryptjs jsonwebtoken nodemailer google-auth-library jose -- --prefix backend
```

Keep the conditional social config in `app.config.js` if the installer offers to add plugin entries. Bare social plugin entries in `app.json` need credentials and should not be duplicated there. `.cmd` avoids PowerShell's blocked `npm.ps1`/`npx.ps1` scripts on this computer.

## Run in two VS Code terminals

Terminal 1, backend:

```powershell
cd D:\RNapp
npm.cmd --prefix backend start
```

For restart-on-save, use `npm.cmd --prefix backend run dev`. Keep this terminal visible for development reset codes. The backend binds to `0.0.0.0:3001` and prints LAN health-check URLs.

Terminal 2, Expo:

```powershell
cd D:\RNapp
npx.cmd expo start --dev-client --lan --clear
```

Open a development build containing the newly added native modules, then connect it to Metro. An existing build from before these dependencies were installed needs rebuilding first.

## Phone API address

The detected Wi-Fi IPv4 address during setup was `192.168.1.175`. The ignored `.env.local` currently contains:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.175:3001
```

1. Keep the phone and computer on the same Wi-Fi network.
2. Open `http://192.168.1.175:3001/health` in the phone browser. Expect `{"status":"ok"}`.
3. If the address changes, run `npm.cmd --prefix backend run setup` to list current addresses and update `.env.local`.
4. Restart Metro after environment changes. If the phone cannot reach `/health`, allow Node.js/inbound TCP port 3001 on Windows Firewall for your private LAN and check guest-network/client isolation or VPNs. No firewall changes were made automatically.

`localhost` on the phone means the phone itself. Expo's Metro tunnel does not expose this separate backend. `app.config.js` enables Android HTTP traffic when the API URL uses HTTP. Changing that native setting requires a rebuild. Release JavaScript requires an HTTPS API URL; this local server setup is intended for learning on a trusted LAN.

## Native rebuild

Native dependencies and configuration cannot be added with a Metro refresh. Expo documents this requirement for both [Google](https://docs.expo.dev/guides/google-authentication/) and [Facebook](https://docs.expo.dev/guides/facebook-authentication/).

### Android error: Cannot find native module 'ExpoSecureStore'

This error means the running Android binary does not expose SecureStore to JavaScript. Installing the npm package or restarting Metro cannot add native code to an already-installed APK. The current project checks show:

- Installed Expo is `54.0.38`. `expo-secure-store` is a runtime dependency at `15.0.8`, matching SDK 54's `~15.0.8` compatibility range and the lockfile.
- Android Expo Modules resolution includes `expo.modules.securestore.SecureStoreModule`. `android/settings.gradle` calls `expoAutolinking.useExpoModules()` and `MainApplication.kt` retains Expo's host/lifecycle integration.
- The SecureStore config plugin is present and config introspection applies its Android backup exclusions.
- The local native project was generated before SecureStore was installed and lacks the newer manifest backup settings. That does not disable autolinking, but it is evidence that the local native configuration is older.
- `/android` is ignored by Git and there is no `.easignore` overriding that exclusion. EAS therefore generates the native project from the current app configuration. No local native files need to be deleted or regenerated for this cloud build.

The reported crash is consistent with an older development APK being opened against the newer Metro bundle. Build one fresh development APK from this project:

```powershell
cd D:\RNapp
npx.cmd eas-cli@latest build --platform android --profile development --clear-cache
```

Install the APK produced by **that build** on the physical phone, replacing the older development app, and open it. Then reconnect it to Metro (`npx.cmd expo start --dev-client --lan --clear` if Metro needs restarting). A new APK is required; clearing Metro alone will not resolve a missing native module. Keep `expo-secure-store` and secure token storage in place.

All ten route/layout files already have default React exports. Because they import the shared auth context, the SecureStore import failure can stop them from loading and produce secondary Expo Router missing-default-export warnings. Resolve the native-module failure first; no route export changes are indicated by the current source.

The checks above verify source configuration and autolinking, not the contents of the APK currently installed on the phone. Runtime confirmation still requires installing and opening the fresh APK. No build or server was started as part of this diagnosis.

Cloud build (no Android Studio required):

```powershell
cd D:\RNapp
npx.cmd eas-cli@latest login
npx.cmd eas-cli@latest build:configure
npx.cmd eas-cli@latest build --platform android --profile development
```

Install the resulting APK on the phone. The included `eas.json` has a development-client profile. Configure the public environment values used by `app.config.js` in the EAS development environment as well: ignored `.env.local` is not uploaded. Use the same provider identifiers for the build and local Metro session. Do not upload backend secrets to the mobile EAS project. Rebuild after changing native provider IDs, Google iOS URL scheme, or cleartext-traffic settings.

If an Android SDK/JDK and USB debugging are already configured, local development is also possible:

```powershell
npx.cmd expo run:android --device
```

Expo/EAS generates `android/` and `ios/` from configuration. Do not edit those generated directories by hand. Native compilation was not run in this implementation session.

## Environment variables

Mobile `.env.local` (all `EXPO_PUBLIC_*` values are public and bundled):

| Variable | Value |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | Computer LAN URL for development; HTTPS backend URL for release |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google OAuth client of type Web application |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google OAuth iOS client; required for iOS Google login |
| `EXPO_PUBLIC_FACEBOOK_APP_ID` | Meta app ID |
| `EXPO_PUBLIC_FACEBOOK_CLIENT_TOKEN` | Meta mobile client token; this is different from the App Secret |

Backend `backend/.env` (server-only; ignored by Git):

| Variable | Purpose |
| --- | --- |
| `JWT_SECRET` | Random secret generated by setup; keep private and stable across restarts |
| `NODE_ENV` | `development` locally; `production` disables terminal reset codes |
| `HOST`, `PORT` | Defaults `0.0.0.0`, `3001` |
| `DATABASE_PATH` | Defaults `./data/auth.sqlite`, relative to backend working directory |
| `SESSION_DAYS` | 1–30 days, default 7; no silent refresh token is issued |
| `CORS_ORIGINS` | Comma-separated allowed browser origins, e.g. `http://localhost:8081`; native requests have no browser CORS requirement |
| `DEV_LOG_RESET_CODES` | `true` explicitly enables development terminal delivery when SMTP is absent |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | SMTP server; usually port 587 with `false` for STARTTLS, or 465 with `true` |
| `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | SMTP authentication and verified sender address |
| `GOOGLE_WEB_CLIENT_ID` | Must match the mobile Web client ID, used as token audience |
| `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` | Matching Meta app ID and private server App Secret |
| `FACEBOOK_GRAPH_VERSION` | Version used for Graph requests; default `v24.0`, use a supported version enabled for your Meta app |

Never use an `EXPO_PUBLIC_` prefix for JWT, SMTP, or Facebook App Secret values. Restart the backend after editing its environment.

## Google Cloud setup

1. Create/select a Google Cloud project. Configure Google Auth Platform branding, audience, and basic `openid`, `email`, `profile` access. Add your Google account as a test user while the app is in testing.
2. Create a **Web application** OAuth client. Put its client ID in mobile `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and backend `GOOGLE_WEB_CLIENT_ID`. No Web client secret is needed for this ID-token flow.
3. Create an **Android** OAuth client with package `com.anonymous.myreactnativeapp` and the SHA-1 of the certificate signing the installed APK. Register separate clients/fingerprints for local debug, EAS development, and Play App Signing as applicable.
4. Restart Metro and backend. Rebuild the development app to include the native Google library.

The package and signing certificate must match the installed app. See the library's [Google Cloud setup](https://react-native-nitro-google-sign-in.github.io/docs/setup/google-cloud/).

Find an EAS certificate with `npx.cmd eas-cli@latest credentials --platform android`; select the development profile and view/download its credentials. If needed, inspect the downloaded keystore using:

```powershell
keytool -list -v -keystore .\path-to-your-keystore.jks -alias your-key-alias
```

Use the displayed SHA-1 fingerprint; keep the keystore/password private. For a local debug build, use that build's debug keystore instead. EAS and Play can sign with different certificates; [Expo's credential guide](https://docs.expo.dev/app-signing/app-credentials/) explains the distinction.

Android uses an explicit Web client ID, so this implementation does not need Firebase or `google-services.json`. For iOS, create an iOS OAuth client for bundle ID `com.anonymous.myreactnativeapp` and set `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`; `app.config.js` registers its reversed client-ID URL scheme through the [Google config plugin](https://react-native-nitro-google-sign-in.github.io/docs/setup/expo/).

The Google button opens the explicit native account picker. The backend verifies Google's signature, audience, issuer/expiry, and server-issued nonce, and uses `sub` as the provider identity. See [Google's token verification guidance](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token). Cancellation returns to Login without creating a session.

## Meta / Facebook setup

1. Create/select a Meta Developer app with the Facebook Login use case available for your app type. Obtain App ID, mobile Client Token, and server App Secret.
2. Set both mobile Facebook variables and backend `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET`. Rebuild the app; `app.config.js` adds the required SDK settings and `fb<APP_ID>` scheme only when public credentials are present.
3. Add Android platform package `com.anonymous.myreactnativeapp`, activity `com.anonymous.myreactnativeapp.MainActivity`, and key hashes for the actual APK signing certificates. Enable the appropriate native login settings in the Meta dashboard.
4. A Meta Android key hash is the Base64 representation of the certificate's SHA-1 bytes. Convert a colon-separated SHA-1 fingerprint in PowerShell:

```powershell
$fingerprint = 'PASTE:YOUR:SHA1:FINGERPRINT'
$certificateBytes = [byte[]]($fingerprint.Split(':') | ForEach-Object { [Convert]::ToByte($_, 16) })
[Convert]::ToBase64String($certificateBytes)
```

5. In development mode, sign in using accepted app administrator/developer/tester roles or eligible Meta test users. Arbitrary public users may be denied. Permissions, public access, business verification, app review, privacy policy, and data-deletion configuration depend on Meta's dashboard and app requirements; complete them before going live. If Meta refuses an unpublished Android package, follow its Play listing/review requirements described in [Expo's Facebook guide](https://docs.expo.dev/guides/facebook-authentication/).
6. For iOS, add the matching iOS bundle identifier in Meta and rebuild. The app uses Limited Login on iOS and validates its signed OIDC token, audience, expiry, and nonce on the backend. Android uses an access token; the backend checks `/debug_token`, app ID, user ID, expiration, then fetches `/me` with `appsecret_proof`.

Facebook controls the login/account experience. Email may be unavailable or permission may be denied; a verified provider ID still identifies the account. The implementation does not need tracking permission or advertising features. Consult the [native SDK's Expo and Limited Login instructions](https://github.com/thebergamo/react-native-fbsdk-next#expo-installation).

## SMTP and development reset codes

For real mail, set the SMTP variables and a sender authorized by your mail provider, then restart the backend. Set `DEV_LOG_RESET_CODES=false` when using real delivery. Test with a mailbox you own.

Without SMTP, the local setup intentionally uses `DEV_LOG_RESET_CODES=true` and prints:

```text
[DEVELOPMENT ONLY - NO EMAIL SENT] Password reset for <email>: <code> (expires in 10 minutes)
```

The app explains that no email was sent. API responses never contain the code, and known/unknown accounts receive the same message. SMTP errors are reported in the backend terminal without exposing credentials. Production startup requires SMTP; terminal delivery is disabled even if its development flag was left set.

Codes are generated with cryptographic randomness and stored as keyed hashes. Verification permits five guesses. A successful check consumes the code and issues a random, hashed, one-time reset grant valid only until the original ten-minute deadline. The grant stays in mobile memory, outside navigation URLs and persistent storage. Reopening the app during reset requires a fresh code. A successful password change invalidates every existing session for that password account. Quick resends within 60 seconds keep the existing code; requests are also limited by IP and email.

## Inspect registered users

```powershell
cd D:\RNapp
npm.cmd --prefix backend run users
```

This prints IDs, emails, names, creation dates, and provider identities without printing password hashes or tokens. The persistent file is `backend/data/auth.sqlite`; it can also be opened in a SQLite viewer. It is ignored by Git. Tests use isolated temporary databases and do not create users in this file.

Social accounts are keyed by provider + provider user ID. They remain **separate accounts** when their email matches a password account or another provider. No automatic linking is performed. A future account-linking feature must require an authenticated session and fresh proof of ownership of both identities.

## Recovering from secure session storage failures

The previous recovery code replaced every failure in `storage.clear()` with “Unable to clear secure storage. Please retry.” This hid whether importing the native module failed, deleting the saved key failed, or another secure-storage operation failed. The message alone is not evidence of an Android Keystore problem.

Secure storage now has a separate adapter in `src/services/session-storage.ts`. It preserves the original exception as `SessionStorageError.cause` and identifies `availability`, `read`, `write`, `delete`, and `verify-delete` separately. Development warnings contain the operation, native error name/code, and a classified reason; token values and raw native error messages are never automatically logged. Missing native APIs are checked before touching data, and there is no AsyncStorage fallback.

Missing sessions return to Login without an unnecessary deletion attempt. Malformed, empty-token, expired, or server-rejected sessions must be removed successfully before recovery completes. Removal is verified by reading the same key and confirming `null`. A failure keeps the recovery gate visible; it cannot expose protected screens. Successful clearing resets the prior recovery error. Concurrent clear requests share one operation, and stale startup requests cannot overwrite newer recovery results.

The development recovery screen includes **Test secure storage**. It reads an independent temporary key, writes a fixed non-secret value, checks the read-back, deletes that temporary key, and confirms its absence. It never reads or modifies the saved session key. Cleanup is attempted even after a partial write fails, and cleanup failures are reported. A passing test does not sign the user in; Retry reloads the real session, or Clear saved session removes it through the verified recovery path.

SDK 54's Android deletion code removes SharedPreferences entries and checks the commit result; deletion does not decrypt the session or remove the Keystore encryption keys. Reads are where stale ciphertext or invalidated keys can cause decryption problems. The SDK already returns `null` for several invalidation/out-of-sync cases. This app does not enable `requireAuthentication`, so it does not intentionally bind session storage to a biometric enrollment. See the [SDK 54 SecureStore documentation](https://raw.githubusercontent.com/expo/expo/sdk-54/docs/pages/versions/v54.0.0/sdk/securestore.mdx).

The installed dependency remains SDK-compatible `expo-secure-store@15.0.8`. Config introspection confirms the plugin emits `@xml/secure_store_backup_rules` and `@xml/secure_store_data_extraction_rules`; these exclude SecureStore preferences from backup and device transfer. The older local Android manifest lacks those settings, but `android/` remains ignored for EAS uploads. No native files or global backup settings were modified during this recovery fix.

During this recovery investigation, Metro on ports 8081/8082 exposed no JavaScript runtime, and ADB reported an empty device list. Native log capture was attempted but could not proceed without an attached/authorized device. Therefore the current installed APK's native availability, its exact native exception, and a physical-device temporary-key test were **not** confirmed. Earlier runtime evidence of a missing module should not be treated as verification of a newly installed APK.

These recovery changes are JavaScript-only and do not require an APK rebuild. A new APK is needed only if the installed binary is verified to lack SecureStore or needs updated native backup configuration. Do not rebuild solely because the old generic error appears. To finish native diagnostics, attach and authorize USB debugging (or configure Android wireless debugging), confirm `adb devices -l` lists the device as `device`, and capture scoped logs:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices -l
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" logcat -d -v brief -t 150 'ExpoSecureStore:V' 'ReactNativeJS:W' 'AndroidRuntime:E' '*:S'
```

No EAS build, new Metro server, app-data reset, saved-session deletion, or device-wide Keystore reset was performed during diagnosis. The temporary-key probe was exercised with test doubles in the essential tests; run the development recovery button on the physical device for its native result.

### ADB confirmation and existing APK replacement

After USB debugging was connected, ADB identified the installed `com.anonymous.myreactnativeapp` APK as last updated **October 27, 2026**. Captured app logs contained `Cannot find native module 'ExpoSecureStore'`; the live runtime also reported the module absent. Inspection of that installed APK's DEX files found no `expo.modules.securestore.SecureStoreModule`, and the APK had neither SecureStore backup resources nor their manifest settings. No session deletion or decryption could run in that binary: its generic recovery error masked a missing native module.

A completed EAS development APK already exists from **November 2, 2026**, build `7e3829a8-0540-4cb1-a2e6-12345e58e8b0`. It was downloaded to the ignored `.expo/latest-development.apk` and verified to have the same package identifier, the SecureStore native class, and the Android backup exclusions. No new EAS build was requested. The installed APK and this EAS artifact use different signing certificates, so Android requires removal of the old package before installing the EAS artifact. That operation clears the old app's local data and requires user approval.

Before replacement, the old app's preferences and files were copied to the ignored `.expo/android-before-apk-replacement.tar` (no contents were printed). Its shared-preferences directory contained only development-launcher preferences, with no SecureStore preferences file. Backend SQLite data is separate and is not affected by Android package replacement. These local diagnostic APKs and the private backup must remain ignored by Git.

At the time of ADB diagnosis, port 8082 was no longer running; the existing port-8081 Metro server was verified to serve this SDK-54 project from `src/app`. The development app was connected to that existing server over ADB USB port forwarding. No additional Metro server was started.

After explicit user approval, the old package was uninstalled and the verified existing EAS APK installed successfully on November 2, 2026. No new APK build was started. The replacement phone runtime reported `ExpoSecureStore` available, zero failed SecureStore imports, a ready root navigator, and the active route `/login`.

The physical-device test passed through the loaded SecureStore SDK: the saved session was absent; an independent temporary key was initially absent, written successfully, read back correctly, deleted successfully, and confirmed absent afterward. No probe errors or fresh app crash/SecureStore errors were present in the scoped logs. The temporary test data was cleaned up. The old app backup remains at `.expo/android-before-apk-replacement.tar`; it was not restored into the fresh development app. Backend data and authentication UI were unchanged. No further APK rebuild is required for this resolved error.

## API and session flow

### Android startup showing Unmatched Route

The connected Android runtime was inspected through the existing Metro debugger. Before the fix, SecureStore was absent, 13 module imports had failed with `ExpoSecureStore`, and Router's `/` matched `+not-found`: the shared auth-context import prevented Router from loading the root layout, index, Login, and password screens. The source files already had valid default exports; `(main)` was not being used incorrectly in navigation URLs. Metro's live manifest correctly selected `src/app`.

The fix defers the SecureStore import to the actual session-storage operations and handles its failure in the startup gate. SecureStore remains mandatory for native session persistence; there is no insecure fallback. The root Stack now stays mounted during session loading, its authenticated/guest screens wait for startup readiness, and the `/` redirect also waits for a ready root navigator. Signup and completed password reset now replace their screen with Login and show the success message there. All navigation targets use existing public paths (`/home`, `/login`, `/sign-up`, `/forgot-password`, `/verify-code`, `/reset-password`); `(main)` remains a navigator group.

After the change, the same phone registered all root/auth routes and `(main)`, had a ready root navigator, and `/` no longer matched `+not-found`. The connected binary still reported SecureStore unavailable. That native issue must be resolved separately by installing an APK that actually includes the module; see the SecureStore rebuild instructions above. A Metro refresh cannot supply native code. No EAS build was started during route diagnosis.

These routing changes themselves are JavaScript-only and do not require an APK rebuild. If Metro was running against stale route files, restart the existing server once with `npx.cmd expo start --dev-client --lan --clear`. Do not start a second Metro server for the same project. End-to-end signup/login/reset confirmation on the phone remains dependent on a working SecureStore native binary and a reachable backend.

```text
React Native Screen → Auth Service → Backend API → SQLite
                  ← Response ← validation/password or provider verification
                  → SecureStore session → protected Home screen
```

| Endpoint | Purpose |
| --- | --- |
| `POST /auth/register` | `{ email, password }`; creates a password account |
| `POST /auth/login` | `{ email, password }`; returns token, expiry, safe user profile |
| `GET /auth/me` | Bearer-token validation and profile lookup |
| `POST /auth/logout` | Bearer token; revokes current server session |
| `POST /auth/forgot-password` | `{ email }`; generic reset response |
| `POST /auth/verify-code` | `{ email, code }`; consumes code, returns reset grant |
| `POST /auth/reset-password` | `{ resetToken, password }`; consumes grant and revokes prior sessions |
| `POST /auth/social/challenge` | `{ provider }`; issues a short-lived nonce |
| `POST /auth/google` | `{ token, nonce }`; verifies Google ID token |
| `POST /auth/facebook` | `{ token, nonce, limited }`; verifies Facebook token |

Only the application token and expiry are persisted in native SecureStore. Passwords and provider tokens are never stored by the app service or in AsyncStorage. Startup validates the saved token with `/auth/me` before displaying protected screens. A network failure shows Retry/Clear Session instead of exposing protected content or discarding a potentially valid session. Local expiry and authenticated API 401 responses clear the session. Foregrounding rechecks it. Logout clears local state immediately and revokes the server session when reachable; offline logout cannot contact the server, so its old server record expires naturally. Server-side checks must protect any future private data APIs too.

## Essential verification

```powershell
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd test
npm.cmd --prefix backend test
```

Validation, route discovery, and secure-storage recovery: 35 tests (21 input-validation tests, 3 route checks, and 11 storage/recovery checks). The route checks verify default component exports, Android Router discovery of all required URLs, and literal navigation targets against that graph. Storage tests use an injected API to cover missing modules, absent/invalid session records, read/write/delete failures, confirmed deletion, temporary-key cleanup, and safe diagnostics. Backend integration: 8 tests for registration, hashing, duplicate email, login failures, authorization, expiration, logout, password reset/replay/retry limits, social identity separation, persistence, and production configuration. Social tests stub the external verification boundary; they do not prove Google/Meta credentials work. Android Metro export and local LAN `/health` were checked. Full native builds, real SMTP delivery, and complete authentication flow testing on-device remain unverified.

## Short manual checklist

1. Reach `/health` from the phone. Sign up with your test email, an eight-character-or-longer password, and matching confirmation. Test invalid email, short password, mismatch, duplicate signup, and each eye icon.
2. Log in with wrong and correct passwords. Confirm Home, About, and Logout work; rapid repeated taps should create only one request.
3. Close/reopen the app: a valid session restores without flashing protected content. Log out, press Android Back, and try a `/home` or `/about` deep link; Login should remain the entry point.
4. Request a reset for registered and unregistered emails; both show the same response. In development, inspect Terminal 1 for the registered account's code. No email should be claimed as sent.
5. Try an incorrect code, five wrong guesses, an expired code, and reusing a verified code. Request a new code when needed. Set a new password; old credentials and sessions must fail, new credentials must work.
6. After configuring Google/Meta and installing the rebuilt app, test real sign-in, cancellation, permission denial, returning users, and a provider account whose email matches a password account. Verify separate local user IDs with `run users`.
7. Stop the backend or disconnect Wi-Fi and try a request. Check the friendly error/retry behavior. Check keyboard scrolling, safe areas, and eye-icon tap targets on the physical phone.

## Files changed

- `backend/package.json`, `backend/package-lock.json`, `.env.example`, `src/{app,config,database,identity,mail,server}.mjs`, `scripts/{setup,users}.mjs`, `tests/auth.test.mjs`: backend, persistence, delivery, scripts, tests.
- `src/services/auth.ts`, `src/services/social-auth.ts`, `src/context/auth-context.tsx`, `src/hooks/use-auth-request.ts`: API, native provider flows, secure session state, request handling.
- `src/services/session-storage.ts`, `tests/session-storage.test.mjs`: secure-storage operations, verified recovery, temporary-key diagnostics, and regression tests.
- `src/components/login/{account-form,form-field,social-login-button}.tsx`, `src/utils/auth-validation.ts`, `tests/auth-validation.test.mjs`: reused forms, visibility controls, accessible social actions, validation.
- `tests/routes.test.mjs`: default-export, Android route-discovery, and navigation-target checks using the installed Router.
- `src/app/_layout.tsx`, `index.tsx`, `login.tsx`, `verify-code.tsx`, `reset-password.tsx`, `(main)/{_layout,home,about}.tsx`: auth routing and protected tabs. Existing `sign-up.tsx` and `forgot-password.tsx` reuse the updated form.
- Removed old `app/{_layout,index,about,sign-up,forgot-password}.tsx` wrappers; moved original login/about/tab code into the routes above.
- `package.json`, `package-lock.json`, `app.json`, `app.config.js`, `eas.json`, `.env.example`, `.gitignore`, `README.md`, this guide: dependencies, config, commands, documentation.
- Generated locally and ignored: `.env.local`, `backend/.env`, `backend/data/auth.sqlite`, and `.expo/auth-check/` export output.
