# Detective Files

A browser-based detective simulation game where the player operates a fully functional police workstation to solve investigations.

---

## Project Vision

Detective Files is not a traditional browser game. The player never navigates menus. Instead, they interact with a simulated police operating system — reading emails, reviewing CCTV footage, analyzing forensic reports, and connecting evidence on an investigation board — all through specialized applications running inside the workstation.

The workstation itself is the game.

---

## Architecture Overview

The project follows a strict plugin-based, event-driven modular architecture.

```
Core System (Workstation Shell)
│
├── EventBus           — decoupled pub/sub communication
├── BaseApp            — base class for all application plugins
├── AppLoader          — dynamically loads application modules
│
Managers
│
├── ApplicationManager — lifecycle of all installed apps
├── WindowManager      — creates and manages all windows
├── DesktopManager     — desktop icons, wallpaper, layout
├── ThemeManager       — applies and switches visual themes
├── StorageManager     — sole access point to localStorage
│
Applications (/apps)
│
├── case-management
├── police-mail
├── messenger
├── evidence
├── forensics
├── cctv
├── city-map
├── board
├── criminal-database
├── settings
└── recycle-bin
```

**Key architectural rules:**

- Applications are plugins. Adding or removing one never modifies the core.
- Applications never communicate directly — only through EventBus.
- Only StorageManager may access localStorage.
- Only WindowManager may manipulate window DOM.
- All configuration lives in JSON files, not JavaScript.

---

## Folder Structure

```
detective-files/
│
├── index.html                  — Entry point. Mounts workstation root.
│
├── core/                       — Workstation engine
│   ├── Workstation.js          — Boot orchestrator
│   ├── BaseApp.js              — Abstract base for all apps
│   ├── EventBus.js             — Global event system
│   └── AppLoader.js            — Dynamic app loader
│
├── managers/                   — System managers
│   ├── ApplicationManager.js
│   ├── WindowManager.js
│   ├── DesktopManager.js
│   ├── ThemeManager.js
│   └── StorageManager.js
│
├── apps/                       — Application plugins
│   ├── case-management/
│   ├── police-mail/
│   ├── messenger/
│   ├── evidence/
│   ├── forensics/
│   ├── cctv/
│   ├── city-map/
│   ├── board/
│   ├── criminal-database/
│   ├── settings/
│   └── recycle-bin/
│
├── css/                        — Stylesheets
│   ├── global.css
│   └── variables/
│       ├── colors.css
│       ├── typography.css
│       ├── spacing.css
│       └── animation.css
│
├── data/                       — Configuration
│   ├── apps.json               — Application registry
│   ├── desktop.json            — Desktop layout
│   ├── theme.json              — Default theme
│   └── settings.json           — Global settings
│
├── cases/                      — Investigation content
│   └── case_001/
│       └── case.json
│
├── assets/                     — Shared assets
│   ├── icons/
│   ├── fonts/
│   ├── wallpapers/
│   └── cursors/
│
├── utils/                      — Shared utility functions
│   └── Utils.js
│
└── docs/                       — Extended documentation
    └── ARCHITECTURE_DECISIONS.md
```

---

## How to Run

No build step required. The project uses native ES6 modules.

**Requirement:** A local HTTP server (browsers block ES6 module imports from `file://`).

**Option A — Python (built-in):**
```bash
cd detective-files
python3 -m http.server 3000
```
Then open: [http://localhost:3000](http://localhost:3000)

**Option B — Node.js (npx):**
```bash
cd detective-files
npx serve .
```

**Option C — VS Code:**
Install the *Live Server* extension and click **Go Live**.

---

## Creating a New Application

1. Create a folder inside `/apps/` with the application id as the name.
2. Add the three required files: `app.json`, `index.js`, `style.css`.
3. In `index.js`, export a class that extends `BaseApp` and implements all lifecycle methods.
4. Add the application id to `data/apps.json` under `"installed"`.
5. The workstation discovers and loads it automatically on next boot.

**app.json minimum:**
```json
{
    "id": "my-app",
    "title": "My Application",
    "icon": "icon.png",
    "version": "1.0.0",
    "singleton": true,
    "resizable": false,
    "width": 800,
    "height": 600,
    "minimumWidth": 600,
    "minimumHeight": 400
}
```

**index.js minimum:**
```js
import BaseApp from '../../core/BaseApp.js';

class MyApp extends BaseApp {
    create()   { /* build DOM */ }
    open()     { /* start listeners */ }
    close()    { /* stop listeners */ }
    minimize() { }
    restore()  { }
    destroy()  { /* clean up */ }
}

export default MyApp;
```

---

## Development Workflow

Each mission is self-contained and builds on the previous:

| Mission | Goal |
|---------|------|
| 00 | Project foundation (this milestone) |
| 01 | Workstation core — boot screen, desktop shell |
| 02 | Desktop environment — icons, taskbar, clock |
| 03 | Window system — dragging, z-index, minimize/restore |
| 04 | Plugin architecture — AppLoader, dynamic launch |
| 05 | Placeholder applications |
| 06 | Storage system |
| 07 | Event system polish |
| 08 | Desktop polish — cursor, context menu, selection |
| 09 | Architecture review |

---

## Architecture Documentation

- [ARCHITECTURE.md](../ARCHITECTURE.md) — core rules
- [APP_SDK.md](../APP_SDK.md) — how to build applications
- [CASE_FORMAT.md](../CASE_FORMAT.md) — investigation data format
- [CODING_STYLE.md](../CODING_STYLE.md) — code standards
- [UI_GUIDELINES.md](../UI_GUIDELINES.md) — visual design rules
- [docs/ARCHITECTURE_DECISIONS.md](docs/ARCHITECTURE_DECISIONS.md) — decision log

---

## Technology

- Vanilla JavaScript — ES2023+ with native ES6 modules
- No bundler, no framework, no build step
- CSS custom properties for theming
- JSON-driven configuration
- LocalStorage for persistence (replaced by REST API in a future phase)
