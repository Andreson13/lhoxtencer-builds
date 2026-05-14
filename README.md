# Lhoxtencer

Lhoxtencer now supports three delivery modes from the same codebase:

1. Web SPA with installable PWA support for phones and tablets.
2. Desktop shell via Electron for Windows installation.
3. IndexedDB-backed offline cache so previously loaded data stays available without network.

## Commands

```bash
npm install
npm run dev
npm run dev:desktop
npm run build:web
npm run build:desktop
npm run dist:win
```

## Desktop Build

`npm run dev:desktop`
Starts Vite and Electron together for local desktop testing.

`npm run build:desktop`
Builds the web app with relative asset paths and packages it with Electron Builder.

`npm run dist:win`
Produces an installable Windows NSIS installer in `release/`.

Installer behavior is configured to:

1. Use a wizard installer instead of one-click install.
2. Let the user choose the installation directory.
3. Create desktop and Start Menu shortcuts.

## PWA

The app is configured as an installable PWA through `vite-plugin-pwa`.

What it provides:

1. Install prompt support on supported mobile and tablet browsers.
2. Cached app shell for reopening without network.
3. Standalone launch behavior after installation.

## Offline Behavior

Offline support is backed by IndexedDB using persisted React Query cache.

Current behavior:

1. Previously fetched screens and query data are restored from IndexedDB.
2. The UI shows an offline banner when the device is disconnected.
3. Static assets are served from the service worker cache.

Important limitation:

1. Server mutations that require Supabase still need connectivity unless they are separately queued with a sync strategy.

## Notes

1. Electron builds use relative asset paths so packaged `file://` loads do not break.
2. Desktop mode uses hash routing so deep links continue to work from packaged builds.
