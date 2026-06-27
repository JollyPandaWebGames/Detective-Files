# Detective Files

# Architecture Rules

Version: 1.0

This document defines the permanent architectural rules for the Detective Files project.

These rules must never be violated.

When implementing new features, improving existing systems, or refactoring code, always follow these rules.

---

# 1. Core Philosophy

Detective Files is **not** a traditional browser game.

It is a simulated police workstation.

The workstation itself is the game.

Every gameplay mechanic must exist as an application running inside the workstation.

Never implement gameplay directly inside the core system.

---

# 2. Modular Architecture

Every major feature must exist as an independent module.

The core system should never depend on any specific application.

The core only knows that applications exist.

The core never knows what those applications do.

---

# 3. Plugin Architecture

Every application is a plugin.

Applications live inside:

/apps/

Each application owns its own:

* JavaScript
* CSS
* Configuration
* Assets (if needed)

Adding or removing an application must not require modifying the core system.

---

# 4. No Hardcoded Applications

Never hardcode application names.

Never write code such as:

openMail()

openMessenger()

openCases()

Instead:

openApp("mail")

Applications are loaded dynamically.

---

# 5. Data Driven Design

Everything possible should come from configuration.

Examples:

Desktop icons

Wallpaper

Themes

Installed applications

Application metadata

Window sizes

Future case definitions

Future investigations

Nothing should require editing JavaScript just to change content.

---

# 6. Separation of Responsibilities

Every class has one responsibility.

Examples:

WindowManager

Only manages windows.

ApplicationManager

Only manages applications.

StorageManager

Only manages persistence.

DesktopManager

Only manages desktop behavior.

ThemeManager

Only manages themes.

Never combine unrelated responsibilities.

---

# 7. Event Driven Communication

Applications must never communicate directly.

Forbidden:

Messenger.openMail()

Mail.openMessenger()

Required:

EventBus.emit(...)

EventBus.on(...)

This prevents coupling.

---

# 8. Storage Access

No module may directly access LocalStorage.

Only StorageManager may use:

localStorage

Later this module will be replaced by an online backend.

Nothing else should require modification.

---

# 9. Base Application

Every application must inherit from BaseApp.

All applications should expose the same lifecycle.

Required lifecycle:

create()

open()

close()

minimize()

restore()

destroy()

Applications should remain predictable.

---

# 10. Window Independence

Applications should never manipulate window behavior directly.

Applications request actions.

WindowManager performs them.

Applications should not know how windows work internally.

---

# 11. Reusability

Duplicate code is forbidden.

If functionality is repeated twice, move it into a reusable utility.

---

# 12. Scalability

The architecture should support:

50+

Applications

100+

Cases

Thousands of assets

Without requiring architectural changes.

---

# 13. Future Backend Compatibility

Current version uses LocalStorage.

Future versions will use:

REST API

Authentication

Cloud Save

Multiplayer

Current code must already be compatible with this future migration.

---

# 14. UI Rules

Use Pixel Art.

Use pixel fonts.

Use pixel borders.

Avoid modern UI trends.

The interface should resemble a police workstation from a retro operating system.

---

# 15. CSS Rules

Never place all CSS in one file.

Separate:

Variables

Desktop

Taskbar

Windows

Components

Applications

Every application owns its own stylesheet.

---

# 16. JavaScript Rules

Use ES6 Modules.

Avoid global variables.

Avoid giant files.

Prefer small reusable classes.

Prefer composition over inheritance unless inheritance is clearly beneficial.

---

# 17. Folder Ownership

Every folder owns its own logic.

Core/

Only workstation engine.

Managers/

Only managers.

UI/

Reusable interface components.

Apps/

Gameplay applications.

Utils/

Generic helper functions.

Never mix responsibilities.

---

# 18. Error Handling

Never silently ignore errors.

Display meaningful console messages.

Use descriptive exceptions.

---

# 19. Naming

Use descriptive names.

Good:

ApplicationManager

WindowManager

StorageManager

DesktopManager

Bad:

app

mgr

helper2

temp

data1

---

# 20. Documentation

Every major class should contain:

Purpose

Responsibilities

Public methods

Important notes

Complex logic should always include comments.

---

# 21. Future Gameplay

Gameplay systems must never be implemented inside the workstation engine.

Examples:

Evidence

Cases

Messenger

CCTV

Forensics

Investigation Board

These are independent applications.

---

# 22. Performance

Avoid unnecessary DOM updates.

Reuse DOM elements whenever possible.

Cache expensive queries.

Lazy-load applications whenever appropriate.

---

# 23. Accessibility

Support keyboard navigation where practical.

Maintain readable contrast.

Support browser zoom without breaking layout.

---

# 24. Refactoring

Whenever code quality can be improved without changing behavior:

Refactor.

Never sacrifice architecture for speed.

---

# 25. AI Development Rule

Whenever implementing a feature:

1. Read this document first.

2. Respect every architectural rule.

3. Never introduce shortcuts that violate these principles.

4. Prefer long-term maintainability over short-term convenience.

5. If a requested feature conflicts with this architecture, explain the conflict before implementing it.

The architecture always takes priority over implementation speed.
