# Next Steps

Future agents must read this file before making code changes and update it after every implementation pass.

Last research audit: 2026-05-26, comparing `docs/deep-research-report.md` against the current repo.

## Preserve As Product Principles

- Keep the app Today-first. The first screen should answer: what do I do today, how long will it take, what equipment do I need, what should I lift or modify, and what counts if energy is low.
- Keep IndexedDB as the source of truth for workout state, with Firebase as optional backup only. The app must stay useful offline and must never require cloud sync to start or complete training.
- Keep localStorage limited to tiny preferences: selected profile, language, quiet mode, and low-energy mode.
- Keep Low Energy / Jet Lag as a valid habit-preserving session, not a failure state.
- Keep Home and Hotel modes first-class. Travel is part of the product, not an edge case.
- Keep beginner guidance, safety language, and progressive overload visible in the execution flow instead of hiding them in a content library.
- Avoid calorie-first framing, public comparison, shame-based streaks, rigid readiness dashboards, cloud-required saving, and random workout novelty that breaks progressive overload.

## P0 - Reliability, Data Trust, And Validation

- Verify the IndexedDB migration on a real iPhone PWA install with existing localStorage data, then document the exact install, refresh, offline, and upgrade behavior.
- Extend automated browser tests to cover additional PT/ES long-string states.
- Run and document the IndexedDB migration path on a physical iPhone Home Screen PWA, not only desktop browser automation.
- Add unit-level tests for backup validation and outbox compaction so those rules are checked without launching the full app.
- Keep `npm audit --audit-level=moderate` at zero findings after dependency updates.

## P1 - Today And Active-Session Execution

- Add duration elasticity beyond the current full/low-energy split: 15, 30, and 50 minute options, with clear programming rules for which exercises/sets stay in each version.
- Add a tiny session warm-up block, especially for strength days, with safe defaults and no extra decision burden.
- Improve the Today summary with equipment needed, estimated duration by selected mode/duration, last relevant load, and the first exercise's key cue.
- Add time-to-start instrumentation locally: app open timestamp, Start press timestamp, and whether the user chose full, shorter, Hotel, or Low Energy.
- Add a session-finish summary that shows completed sets, session type, best lift/core note, RPE, and a non-shaming next action.
- Add one-handed active-session polish: fixed primary set action, large timer controls, clear previous/next exercise context, and no bottom-nav collision on iPhone safe areas.
- Add optional auto-advance behavior after the final set of an exercise, with an obvious manual override.
- Add warm-up load suggestions for weighted exercises when enough history exists.

## P1 - Travel, Equipment, And Replacement Quality

- Add a Hotel equipment checklist for the current stay: dumbbells, bench, cable station, bands, pull-up bar, floor space, and no-equipment only.
- Filter swaps by available equipment: Your Equipment, No Equipment, Same Equipment, Different Equipment.
- Add travel-week templates that preserve the same day order but bias toward dumbbell/bodyweight alternatives and shorter duration choices.
- Show mode-specific equipment notes in Today before starting, not only inside individual exercises.
- Add a quick "hotel room only" fallback that avoids assumptions about benches, pull-up bars, or heavy weights.
- Track environment mix locally: Home, Hotel, and Low Energy frequency over time.

## P1 - Beginner Guidance, Safety, And Progression

- Expand exercise guidance into movement-pattern teaching: squat, hinge, push, pull, carry, anti-extension, anti-rotation, and loaded core bracing.
- Add clearer regression and progression steps for every exercise, including when to choose each variation.
- Add equipment alternatives where missing, especially for Hotel mode and no-equipment fallbacks.
- Add downloadable or cached lightweight form media once assets exist. Offline media should be treated as normal PWA behavior, not an online-only bonus.
- Add "technique day" support for low-skill or low-energy days, where the goal is high-quality practice rather than load progression.
- Add a head-to-knees mobility milestone tracker as a long-term graded objective, without turning mobility into the app's main score.
- Keep safety copy concise but visible: stop or modify for pain, regress when form breaks, and seek medical guidance after inactivity or with medical concerns.

## P2 - Habit Systems Without Shame

- Add first-run onboarding that explains offline-first storage, persistent storage, Home/Hotel modes, and Low Energy as a valid fallback.
- Add reminder cue planning: choose a time, place, or context anchor, then pair it with a fallback rule for busy or travel days.
- Add non-pestering notification copy for iPhone PWA users when notification support is enabled.
- Add streak repair instead of streak punishment: missed days should lead to a recovery prompt or short return session, not a hard reset experience.
- Add weekly review prompts focused on training-day completion, consistency, and one small next-week adjustment.
- Track fallback usage as adherence intelligence, not failure analytics.

## P2 - Progress And Analytics

- Build richer progression views for a small set of anchor lifts and core benchmarks instead of a broad sports-science dashboard.
- Add per-exercise history sheets with recent loads, notes, RPE, completed sets, and PRs.
- Add simple trend views for training-day completion, session completion rate, Home/Hotel mix, Low Energy use, swap frequency, timer use, and sync retry success.
- Add local-only friction analytics: time-to-start, abandon-before-start, session interruptions, completed duration version, and offline write success.
- Add a core-strength milestone view that makes planks, carries, anti-rotation work, and bracing progress easy to understand.
- Preserve CSV export and extend it when new metrics are added.

## P3 - Optional Social And Accountability

- Add an optional accountability partner or weekly check-in flow that shares completion status without exposing detailed logs by default.
- Add coach-share/export views for selected periods.
- Avoid feeds, leaderboards, public comparison, or default social pressure.

## Engineering Quality

- Split `src/App.jsx` into focused modules: app shell, profile loading, Firebase sync, Today, Plan, Progress, Session, import/export, analytics, and hooks.
- Code-split Firebase or lazy-load optional backup sync to reduce the production bundle.
- Review Workbox runtime caching after media assets exist: shell precache, navigation fallback, stale-while-revalidate static assets, and predictable offline behavior.
- Add a hard-coded string audit script for app UI copy outside `src/data/i18n.js` and workout data.
- Add Playwright or browser-based visual checks for iPhone widths, safe-area bottom nav, timer controls, import modal, and active-session long strings in PT/EN/ES.
- Add performance budgets for app shell size and first usable Today render.
