# Versioning

**Current version: v1.1.0**

## Format

Detective Files follows semantic-style versioning: `MAJOR.MINOR.PATCH`.

## Central Source

The version lives in exactly one place: **`/VERSION.json`** at the project
root.

```json
{
    "version": "1.1.0",
    "major": 1,
    "minor": 1,
    "patch": 0,
    "codename": "Tutorial Update",
    "releasedAt": "2026-08-15"
}
```

`managers/VersionManager.js` loads this file once at boot and exposes it to
the rest of the app:

```js
import VersionManager from '../managers/VersionManager.js';

VersionManager.getVersion();         // "1.1.0"
VersionManager.getDisplayVersion();  // "v1.1.0"
VersionManager.getVersionData();     // full parsed object
```

**Nothing else in the codebase hardcodes a version string.** Any UI that
shows the version (currently: the Splash Screen and Settings → About) reads
from `VersionManager`, not a literal.

## Release Rules

| Change type | Bump | Example |
|---|---|---|
| Breaking / major changes | `MAJOR` (X.0.0) | Rewriting the save format |
| New features | `MINOR` (x.X.0) | Adding a new application, a new case, this tutorial system |
| Bug fixes / small changes | `PATCH` (x.x.X) | Fixing a broken evidence link |
| Documentation-only changes | No bump required, unless shipped as part of a release | Editing this file |

Every development task should explicitly decide whether the version needs to
change — but the version is **not** bumped automatically for every internal
change. A tiny refactor with no user-facing effect does not need a patch
bump.

## History

| Version | Summary |
|---|---|
| 1.0.0 | Baseline release. |
| 1.1.0 | Rebuilt Case 00 as a fully guided, mentor-driven tutorial (see `docs/TUTORIAL_SYSTEM.md`); added project version control; added landscape-only enforcement (see `docs/PLATFORM_REQUIREMENTS.md`); added a developer splash screen (see `docs/SPLASH_SCREEN.md`). |
| 1.1.1 | Fixed a tutorial soft-lock: instruction steps waiting on a singleton app-open or other idempotent/guarded action (e.g. Police Mail already open, a mail already read, an analysis already submitted) could wait forever for an event that would never re-fire. Steps now check whether their condition is already true before locking on a live event. |
| 1.1.2 | Replaced the splash screen's placeholder studio logo emoji with the real Jolly Panda Studio mark (`assets/branding/jolly-panda-logo.png`). |
| 1.1.3 | Fixed the tutorial restarting from "Welcome" whenever an abandoned run (page reload, closed tab) was resumed, even though the player's actual investigation progress had continued. Tutorial progress is now persisted via `StorageManager` and resumed at the exact saved step; a full reset now only happens on a genuine fresh replay (previous run completed or skipped). |
