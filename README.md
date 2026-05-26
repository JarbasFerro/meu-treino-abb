# Hybrid Fit Daily Training

Personal offline-first training execution app for daily 50-minute workouts at home or while traveling.

## Product North Star

Make daily training unavoidable, understandable, and portable.

The app is built as a training cockpit, not a content library. It opens around today's workout, shows the next exercise, tracks sets and load, keeps a streak, and lets the user switch between Home, Hotel, and Low Energy modes with minimal friction.

## Agent Handoff Rule

Before implementing any future code change, agents must read `docs/implementation-log.md` and `docs/next-steps.md`.

After implementing, agents must append or update `docs/implementation-log.md` with what changed, and update `docs/next-steps.md` so it reflects the remaining work. Treat both files as required planning context for every future implementation.

## Core Features

- Today-first workout cockpit with completion, set count, streak, and next exercise.
- Home and Hotel plans for the same 7-day training split.
- Low Energy / Jet Lag mode that caps exercise volume to preserve the habit.
- Beginner guidance per exercise: cues, setup notes, common mistakes, and progression advice.
- Progressive overload logging for weighted movements.
- Rest timer with speech or audio fallback, plus quiet mode.
- IndexedDB-first persistence, with optional Firebase backup sync.
- Workbox-powered PWA manifest and service worker for installable offline use.

## Tech Stack

- React 19
- Vite
- Tailwind CSS v4
- Firebase Auth and Firestore, optional via environment variables

## Local Development

```bash
npm install
npm run dev
```

The Vite dev server serves the app under `/meu-treino-abb/`, matching the GitHub Pages deployment base.

## Build And Verify

```bash
npm run lint
npm run build
```

## Optional Firebase Sync

The app works without Firebase. To enable cloud sync, copy `.env.example` to `.env.local` and fill the Vite Firebase variables.

Firestore rules are in `firestore.rules`. The current rules allow authenticated anonymous users to read and write only the `jarbas` and `isabella` profile documents.

## Deployment

```bash
npm run deploy
```

The project is configured for GitHub Pages at:

https://JarbasFerro.github.io/meu-treino-abb
