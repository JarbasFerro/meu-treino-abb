# iPhone PWA Validation Results

Use this file to record physical iPhone 15 Pro Home Screen validation runs. The checklist in `docs/iphone-pwa-validation.md` remains the source of what to test.

## Latest Run

- Date:
- App URL: `https://jarbasferro.github.io/meu-treino-abb/`
- Commit tested:
- iOS version:
- Install state: Fresh install / existing Home Screen app / upgraded Home Screen app
- Network state tested: Online / Airplane Mode / reconnect
- Result: Pass / Fail / Partial

## Evidence Checklist

- Today opens directly in English with no profile, language, or sound controls:
- Dynamic island safe area keeps header controls reachable:
- Standalone status bar color works with the app background:
- Start actions are visible early on the iPhone 15 Pro first viewport:
- Bottom navigation avoids the home indicator and keeps 44px+ targets:
- Rest timer stacks above sticky session actions without overlap:
- Active session survives close and relaunch:
- Load, RPE, note, completed set, and warm-up state persist in IndexedDB:
- Offline refresh keeps the PWA shell usable:
- Set logging works while offline:
- Reconnect leaves the app responsive while backup retry runs:
- JSON export works:
- Import confirmation modal fits without clipped controls:
- Update prompt appears after a new deployment:
- Update preserves local workout data:
- Existing legacy localStorage data migrates to IndexedDB without deleting old keys:

## Notes And Follow-Ups

- 
