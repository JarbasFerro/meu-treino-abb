# Agent Instructions

This repository contains critical workflows and rules that all AI agent assistants must follow when working on the meu-treino-abb project.

## Core Rules

1. **Maintain Implementation Log:**
   - Append a dated entry to [docs/implementation-log.md](file:///Users/jarbas/Documents/code/meu-treino-abb/docs/implementation-log.md) after every implementation pass or code change.
   - Record what was modified, bundle budget verification size, and manual/automated test results.

2. **Maintain Next Steps Backlog:**
   - Review and update [docs/next-steps.md](file:///Users/jarbas/Documents/code/meu-treino-abb/docs/next-steps.md) after each iteration.
   - Mark completed backlog items and detail next priorities (P0, P1, P2) for active sessions, travel templates, safety progression, habit designs, or analytics.

3. **Verify and Protect the Bundle Budget:**
   - The main app shell must not exceed the **275.00 kB** minified budget limit.
   - Split large components (e.g. `PlanView`, `ProgressView`, and modals like `HistoryDrawer`) using `React.lazy` and `Suspense`.
   - Run `npm run build && npm run check:bundle` to verify.

4. **Run Verification Tests:**
   - Run Vitest unit tests: `npm run test:unit`
   - Run Playwright E2E tests: `npm run test:e2e` (inspected in the iPhone 15 Pro viewport mockup).
   - Ensure all tests pass with zero errors.

5. **Commit and Push:**
   - After successfully verifying your changes and updating the documentation logs, always commit your changes and push them directly to the `main` branch.
