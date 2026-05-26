# iPhone PWA Validation Checklist

Use this checklist on an iPhone 15 Pro after installing the GitHub Pages app to the Home Screen. Record each physical run in `docs/iphone-pwa-validation-results.md`.

## Install And Shell

- Open `https://jarbasferro.github.io/meu-treino-abb/` in Safari and add it to the Home Screen.
- Launch from the Home Screen, not from a Safari tab.
- Confirm the app opens directly to Today in English with no profile, language, or sound buttons.
- Confirm the app extends behind the iOS status area while header controls remain below the dynamic island protected zone.
- Confirm the status bar style works with the app background and the Reset button is reachable.

## Core Offline Flow

- Open Today, start a `50 min` session, complete the warm-up, log one set, then close the app.
- Relaunch from the Home Screen and confirm the active session, logged set, load, RPE, and note are still present.
- Enable Airplane Mode, relaunch the PWA, and confirm Today still renders and a set can still be logged.
- Disable Airplane Mode and confirm the app remains responsive while any pending backup retry happens in the background.

## Lower Controls

- Start a session, complete one set, and confirm the rest timer appears above the sticky session controls.
- Confirm the rest timer controls, sticky actions, bottom navigation, and home indicator do not overlap.
- Confirm `Previous`, `Complete set`, and `Next exercise` remain readable and tappable one-handed.

## Progress And Backup

- Open Progress and export JSON.
- Start an import with that JSON and confirm the modal fits within the screen without clipping buttons.
- Cancel the import unless intentionally testing restore.

## PWA Update Path

- After a new deployment, relaunch the app and confirm the update prompt appears when a new service worker is ready.
- Tap Update and confirm the app reloads into the latest version without losing local workout data.
