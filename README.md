# Home and About

A simple Expo app with two bottom tabs, sample content, and light and dark themes.

## Run

```bash
npm install
npx expo start
```

If Metro was already running before the routes moved, restart it to load `src/app/`.

## Project structure

- `src/app/_layout.tsx`: Home and About tab navigation.
- `src/app/index.tsx`: Home screen.
- `src/app/about.tsx`: About screen.
- `src/components/screen.tsx`: Shared screen and card components.
- `src/constants/theme.ts`: Light and dark colors.
- `app/`: Compatibility routes for development clients that still use the old route directory.

## Check

```bash
npm run lint
npx tsc --noEmit
node --test tests/auth-validation.test.mjs
```

See [authentication setup and phone testing](docs/authentication.md) for the current provider status, Sign Up and Forgot Password routes, and a step-by-step test checklist.
