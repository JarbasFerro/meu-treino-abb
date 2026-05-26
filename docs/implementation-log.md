# Implementation Log

Future agents must read this file before making code changes. Append a dated entry after every implementation pass.

## 2026-05-26 - Start-first Today and bundle guardrail

- Moved Today start actions above secondary metrics and the Next Up card so `15 min`, `30 min`, `50 min`, Low Energy, and Resume are visible earlier on the iPhone 15 Pro first viewport.
- Added display-only load hints in Today and active sessions using existing weight and personal-record data, including neutral no-history copy and warm-up load guidance for weighted exercises.
- Added `npm run check:bundle`, which reads the built main app shell from `dist/index.html` and fails above 275 kB minified; current shell verified at 257.25 kB.
- Added `docs/iphone-pwa-validation-results.md` and linked it from the physical iPhone checklist so real Home Screen validation runs can be recorded without fabricating device results.
- Extended Playwright coverage for start-action first-viewport placement, empty load-hint state, and seeded-history load hints.
- Verified with `npm run lint`, `npm run build`, `npm run check:bundle`, `npm run test:unit`, and `npm run test:e2e`.

## 2026-05-26 - iPhone 15 Pro UI backlog update

- Added next-step requirements to optimize the PWA specifically for iPhone 15 Pro as the target device.
- Captured the need to use the full top screen area while respecting the dynamic island protected zone.
- Added compact bottom navigation and lower-control stacking checks to the execution-flow backlog and visual test backlog.

## 2026-05-26 - Single-user reliability cleanup

- Promoted the single active profile to the shared storage constant `jarbas` and tightened backup validation/import so missing profile IDs and `jarbas` are accepted while other profile IDs are rejected.
- Pruned runtime i18n data to English-only app copy, removed unused PT/ES workout translation maps, and updated import copy to reference the single device profile.
- Added `vitest` and `fake-indexeddb` with focused storage tests for backup validation, normalization, import rules, legacy migration, and outbox compaction.
- Lazy-loaded Firebase Auth/Firestore only when Firebase environment variables are present; the main app shell dropped from about 650.62 kB minified to 261.59 kB minified, with optional Firebase chunks loaded separately.
- Extended iPhone Playwright checks for import-modal geometry and active-session sticky-action label containment, and added `docs/iphone-pwa-validation.md` for physical Home Screen PWA validation.
- Verified with `npm run lint`, `npm run build`, `npm run test:unit`, `npm run test:e2e`, and `npm audit --audit-level=moderate`.

## 2026-05-26 - Simplified single-user header controls

- Removed the header language, sound/quiet-mode, and profile-switch buttons to reclaim iPhone 15 Pro header space.
- Fixed the runtime language to English and kept rest-timer speech/audio alerts always enabled.
- Collapsed the app to one fixed `jarbas` profile so the app opens directly into Today without a profile-selection screen; Firestore rules and backup validation now accept only that single profile.
- Updated browser tests to assert the removed controls stay absent while existing migration, session, import/export, offline, and iPhone layout behavior still works.
- Updated README, internal documentation, and next steps to reflect the single-profile, English-only, sound-on app model.

## 2026-05-26 - iPhone 15 Pro screen optimization

- Updated the PWA viewport and Apple standalone metadata for edge-to-edge display with `viewport-fit=cover` and translucent iOS status bar behavior.
- Added global safe-area and control-stack CSS variables for top inset, bottom inset, compact tab rail height, sticky session actions, and rest timer offsets.
- Compressed the app shell for the target iPhone 15 Pro viewport: compact safe-area-aware status strip, narrower mobile content width, reduced Today spacing, and a shorter three-tab bottom rail with 44px+ tap targets.
- Rebalanced lower active-session controls so warm-up actions, session actions, rest timer, and bottom navigation do not overlap on the iPhone 15 Pro-sized viewport.
- Updated Playwright's mobile project to iPhone 15 Pro dimensions and added visual/geometry coverage for Today, warm-up, active session with rest timer, compact nav tap targets, and PT/EN/ES header/nav containment.
- Verified with `npm run lint`, `npm run build`, and `npm run test:e2e`; the existing production bundle-size warning remains as a later engineering-quality item.

## 2026-05-26 - Execution flow upgrade

- Added 15, 30, and 50 minute session starts, with deterministic set caps for shorter sessions and Low Energy remaining a separate habit-preserving mode.
- Added localized warm-up flow with persisted `warmupDone`, active-session duration metadata, session-start timing, and local `sessionMetrics`.
- Improved Today with selected duration, planned set count, first cue, equipment, and last-load visibility.
- Added finish summaries with session type, duration, time to start, completed/planned sets, PR count, average RPE, and best load.
- Extended CSV export with duration and Low Energy columns while preserving completed-set and weight key formats.
- Added Playwright coverage for duration scaling, warm-up persistence, Low Energy, finish summary, CSV columns, and PT/EN/ES execution copy.

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
