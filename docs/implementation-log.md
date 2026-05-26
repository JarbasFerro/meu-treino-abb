# Implementation Log

Future agents must read this file before making code changes. Append a dated entry after every implementation pass.

## 2026-05-26 - Local-first reliability stabilization

- Added Playwright browser tests for profile selection, legacy localStorage migration, active-session refresh, set logging, JSON/CSV export, invalid import rejection, valid import, and offline shell refresh.
- Added profile-backup validation before import so malformed JSON, missing critical fields, invalid field shapes, and unknown profile IDs are rejected before replacing selected-profile data.
- Changed PR detection to compare current active-session load against a baseline captured at session start; personal records now update when a set is completed rather than while typing load.
- Kept completed-set and weight key formats unchanged while making logged set rows update when exercise-level weight, RPE, or note values change.
- Compacted repeated pending `profileData` Firebase backup mutations in the IndexedDB outbox so only the latest snapshot per profile remains queued.
- Updated storage status handling to warn for temporary persistence or high quota usage, and refreshed internal documentation to describe IndexedDB as the local source of truth.

## 2026-05-26 - Deep research backlog audit

- Compared `docs/deep-research-report.md` against the current repo implementation.
- Confirmed the core local-first foundation is already present: IndexedDB profile data, Workbox PWA build, optional Firebase outbox, persistent-storage request, Low Energy fallback, notes/RPE/PRs, and import/export.
- Rebuilt `docs/next-steps.md` into a prioritized research-backed backlog covering reliability, Today/session execution, travel adaptation, beginner guidance, habit design, progress analytics, optional accountability, and engineering quality.
- Recorded product principles that future changes should preserve, including Today-first execution, travel as a first-class mode, Low Energy as valid training, and avoiding shame-based or cloud-required patterns.

## 2026-05-26 - Core PWA best-practices upgrade

- Added IndexedDB as the local source of truth through `hybridFitDb`, with `profileData`, `syncOutbox`, and `appMeta` stores.
- Added one-time migration from existing localStorage profile keys while leaving those keys untouched for compatibility.
- Kept localStorage for small preferences only: selected profile, language, quiet mode, and low-energy mode.
- Added foreground Firebase backup through a local outbox that retries on app open, profile switch, online events, and active use.
- Added persistent-storage request and compact local/sync status badges in the header.
- Replaced the manual service worker with Workbox generation through `vite-plugin-pwa`, including app update prompting.
- Added session execution data: previous/best load display, best set count, optional notes, RPE, PR badge, and set-level log records.
- Added JSON import/export and CSV workout-log export from the Progress view.
- Added localized safety guidance and inline cue surfacing in the active session.
- Added `docs/next-steps.md` and `docs/best-in-class-roadmap.md` as required future planning context.
- Added `idb` and `vite-plugin-pwa`, then applied safe audit fixes so `npm audit --audit-level=moderate` reports zero vulnerabilities.
