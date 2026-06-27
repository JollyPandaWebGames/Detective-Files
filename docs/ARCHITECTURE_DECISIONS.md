# Detective Files
# Architecture Decision Log

This document records key architectural decisions made during development.
Each entry explains the problem, the decision, and the reasoning.

---

## ADR-001 — Native ES6 Modules, No Bundler

**Decision:** Use native browser ES6 modules. No Webpack, Vite, or Rollup.

**Reasoning:**
- Eliminates build complexity for a project focused on architecture clarity.
- Native modules enforce explicit dependency graphs — exactly what this plugin architecture requires.
- Dynamic `import()` is used by AppLoader to lazy-load applications, which is a native browser capability.
- A bundler can always be introduced later without changing module structure.

---

## ADR-002 — Singleton Managers

**Decision:** All managers (ApplicationManager, WindowManager, etc.) are module-level singletons.

**Reasoning:**
- The workstation has exactly one window system, one event bus, one storage layer.
- Singletons prevent multiple competing instances from conflicting.
- ES6 module caching means each manager module is evaluated once — the singleton is a natural consequence of the module system rather than a fragile global variable.

---

## ADR-003 — EventBus as the Only Cross-Module Communication Channel

**Decision:** Applications may never call each other directly. All cross-module communication goes through EventBus.

**Reasoning:**
- Without this rule, adding any feature creates an unpredictable web of dependencies.
- EventBus decouples emitters from receivers. An application emitting `mail:new` has no idea what is listening — and does not need to.
- This makes it safe to add, remove, or replace any application without touching anything else.

---

## ADR-004 — StorageManager as the Sole localStorage Access Point

**Decision:** Only StorageManager may call localStorage. All other modules use StorageManager.

**Reasoning:**
- Future versions will replace localStorage with a REST API backend.
- If localStorage were called throughout the codebase, the migration would require touching every file.
- With this rule, the migration requires changing exactly one file: StorageManager.

---

## ADR-005 — Applications as Plugins with Dynamic Discovery

**Decision:** Applications are not imported by the core. They are discovered at runtime via apps.json and loaded dynamically.

**Reasoning:**
- Hardcoded imports would mean the core system must be modified every time an application is added.
- Dynamic discovery means a new application requires only: creating its folder, adding three files, and registering its id in apps.json.
- This enables future features like downloadable DLC applications or community plugins.

---

## ADR-006 — CSS Custom Properties for All Design Tokens

**Decision:** Every color, spacing value, font, and animation duration is a CSS custom property. Raw values never appear in stylesheets.

**Reasoning:**
- Theme switching requires changing only the custom property values on `:root`.
- Applications that use variables automatically adapt to any theme without code changes.
- Prevents inconsistency from repeated magic numbers scattered through stylesheets.

---

## ADR-007 — BaseApp Enforces Lifecycle Contracts

**Decision:** BaseApp throws an Error if a required lifecycle method is not overridden.

**Reasoning:**
- Silent incomplete implementations are harder to debug than explicit errors.
- Every application must implement all six lifecycle methods. Throwing at runtime makes omissions immediately obvious during development.
- Optional lifecycle methods (onFocus, onResize, etc.) have empty default implementations so applications only override what they need.

---

## ADR-008 — CSS Scoped by Application

**Decision:** Every application owns its stylesheet. All CSS classes are prefixed with the application id.

**Reasoning:**
- Prevents style leakage between applications.
- Makes it trivial to identify which application is responsible for any style.
- Applications can be removed without leaving orphaned CSS rules.

---

## ADR-009 — Data-Driven Configuration

**Decision:** Nothing that can live in JSON should live in JavaScript.

**Reasoning:**
- Desktop layout, wallpaper, installed applications, window dimensions, theme colors — none of these require code changes to modify.
- This future-proofs the system for a CMS or admin panel that edits JSON, not JavaScript.
- Cases and investigations are entirely JSON-driven, meaning the engine never needs modification when new content is added.
