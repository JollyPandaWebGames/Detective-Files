# Detective Files — Architecture Decision Log
# Updated: Mission 15 Review

## ADR-001 — Native ES6 Modules, No Bundler
Dynamic `import()` in AppLoader enables lazy loading. No build step needed.

## ADR-002 — Singleton Managers
All managers are module-level singletons. ES6 module caching ensures one instance per manager.

## ADR-003 — EventBus as Only Cross-Module Channel
Applications never call each other. EventBus decouples emitters from receivers.

## ADR-004 — StorageManager as Sole localStorage Access Point
One migration point when the backend is introduced.

## ADR-005 — Plugin-Based Application Discovery
apps.json drives discovery. Adding an app requires no core changes.

## ADR-006 — CSS Custom Properties for All Design Tokens
Theme switching updates :root variables only. All components adapt automatically.

## ADR-007 — BaseApp Default Lifecycle
Default implementations mean placeholder apps need zero boilerplate.

## ADR-008 — CSS Scoped by Application
All app classes prefixed with app id. No style leakage possible.

## ADR-009 — Data-Driven Configuration
JSON files drive case content, evidence, people, cameras, maps, conversations.
No engine changes required for new case content.

## ADR-010 — Timestamp-Based Forensics Timers
requestedAt + duration stored in StorageManager. Completion survives app restart.
No active interval needed — status derived on every read.

## ADR-011 — Canvas for Map and Board
HTML Canvas 2D API for City Map and Investigation Board.
Same offset+zoom pattern across both. Hit-testing via bounding box / segment distance.

## ADR-012 — Case Data Folder Structure
data/cases/{caseId}/{domain}/  — evidence, forensics, people, map, cctv, messenger
Each domain has an index.json manifest. Lazy-loaded per case per application.

## ADR-013 — Lazy Case Data Loading
Managers load persisted state at boot (initialize()).
Per-case data loads only when a case is selected (loadForCase(caseId)).
Cache prevents re-fetching already-loaded cases within a session.

## ADR-014 — EvidenceManager.registerItem() for Runtime Evidence
CCTV captures and forensics results inject evidence at runtime without JSON files.
Cache and active map updated together; evidence:loaded re-emitted so UI refreshes.

## ADR-015 — BoardManager Stores Nodes as Plain Objects
No class instances for nodes or connections. Plain JS objects + direct StorageManager
serialisation. Avoids prototype chain issues with JSON.stringify/parse round-trips.
