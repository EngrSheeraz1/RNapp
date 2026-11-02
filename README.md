# Expo app with local authentication

An Expo SDK 54 app with email/password authentication, secure sessions, password reset, and native Google/Facebook integrations. It keeps the original login styling and uses protected Home and About tabs.

## Run

```bash
npm.cmd ci
npm.cmd --prefix backend ci
npm.cmd --prefix backend run setup
# First setup only: copy .env.example to .env.local and set your LAN address.
npm.cmd --prefix backend start
# In a second terminal, after installing a rebuilt development client:
npx.cmd expo start --dev-client --lan --clear
```

If Metro was already running before the routes moved, restart it to load `src/app/`.

## Project structure

- `src/app/_layout.tsx`: Session bootstrap and protected routes.
- `src/app/login.tsx`: Original login UI connected to authentication.
- `src/app/(main)/`: Protected Home/About tabs.
- `src/context/auth-context.tsx`: SecureStore session state and reset flow.
- `src/services/`: Backend API and native social sign-in adapters.
- `backend/`: Express API and persistent SQLite database (Node.js 24+).
- `src/components/screen.tsx`: Shared screen and card components.
- `src/constants/theme.ts`: Light and dark colors.

## Check

```bash
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd test
npm.cmd --prefix backend test
```

See [authentication setup and phone testing](docs/authentication.md) for environment variables, native rebuilds, exact Google/Meta setup, SMTP, database inspection, changed files, and a manual test checklist. Google, Facebook, and real email delivery require your external credentials; development resets print codes only in the backend terminal.
