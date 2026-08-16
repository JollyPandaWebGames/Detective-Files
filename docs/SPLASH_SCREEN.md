# Splash Screen

**Status:** v1.1.0
**Related files:** `core/SplashScreen.js` · `css/boot/splash.css`

## Structure

```
🐼
Jolly Panda Studio
presents
────────
🕵️
DETECTIVE FILES
v1.1.0
```

- **Developer branding** — studio logo/emoji + name ("Jolly Panda Studio"),
  matching the existing branding already shown in Settings → About.
- **Game branding** — the Detective Files badge and title.
- **Version** — read from `VersionManager.getDisplayVersion()`. Never a
  literal string — see `docs/VERSIONING.md`.

No new logo was invented; the studio name and emoji badge reuse what
Settings → About already established (`apps/settings/index.js`).

## Asset Requirements

The splash is emoji/CSS-only by design — it needs no image assets and thus
has no broken-image risk regardless of deployment target. If real
logo artwork is added later, replace `.splash-screen__studio-logo` /
`.splash-screen__game-badge` content in `SplashScreen.js` with an `<img>`
and update `docs/SPLASH_SCREEN.md` accordingly.

## Loading Behavior

`SplashScreen.run(root, loadingWork)`:

1. Mounts and fades in immediately, before `ThemeManager`, `BootScreen`, or
   any desktop DOM exists — it is the very first thing rendered (see the
   boot sequence at the top of `core/Workstation.js`).
2. Holds for a **minimum** of 1.5s so it never flashes by, even if
   `VERSION.json` loads instantly.
3. Simultaneously awaits real startup work — currently
   `VersionManager.initialize()` (the `VERSION.json` fetch) — passed in as
   `loadingWork`. If that work is still pending past the minimum hold, the
   splash stays visible for it.
4. Never holds longer than a **3s ceiling**, even if `loadingWork` is still
   pending — the player is never stuck looking at a splash screen.
5. Fades out over 300ms and resolves, after which `Workstation.boot()`
   continues into `ThemeManager` → `BootScreen` → the desktop.

No user interaction is required at any point.

## Version Display

The version line pulls from the same central `VersionManager` used by
Settings → About — see `docs/VERSIONING.md`. It is styled small and muted
(`--color-text-disabled`, `--font-size-xs`) so it's legible without
competing with the game title for attention, per the "readable but not
visually dominant" requirement.
