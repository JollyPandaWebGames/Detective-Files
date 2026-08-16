# Platform Requirements

**Status:** v1.1.0
**Related files:** `utils/OrientationGuard.js` · `css/orientation/orientation.css`

## Landscape Requirement

Detective Files is a **landscape-only** experience on every supported
device. It must never intentionally present the game UI in portrait mode.

## Why device-and-orientation, not just aspect ratio

Landscape enforcement is a rule about **touch devices** (phone/tablet), not
about window shape in general. A desktop browser resized to a narrow, tall
window is not a portrait phone and is never asked to rotate — there is
nothing to rotate. `OrientationGuard` therefore only activates when *both*
of these are true:

1. The device is touch-capable (`'ontouchstart' in window ||
   navigator.maxTouchPoints > 0`).
2. The current viewport is taller than it is wide
   (`window.innerHeight > window.innerWidth`).

This is layered on top of the existing `ResponsiveMode` phone/tablet/desktop
breakpoint system (`utils/ResponsiveMode.js`) — `ResponsiveMode` decides
*layout density*, `OrientationGuard` decides whether the game is allowed to
render at all right now. The two are independent and do not replace one
another.

## Supported Device Categories

| Category | Landscape enforced? |
|---|---|
| Desktop (mouse/keyboard) | No — orientation is not meaningful here. |
| Mobile browser (phone) | Yes. |
| Tablet | Yes. |
| Supported embedded / WebView environments | Yes, if touch-capable. |

## Behavior

### Portrait detected on a touch device

`OrientationGuard` mounts a full-screen overlay (`.orientation-guard`)
**on top of** the game, reading:

> 🔄 Please rotate your device
> Detective Files is designed for landscape mode.

The game UI underneath is not destroyed — it simply isn't visible or
reachable while the overlay is mounted (the overlay covers the full
viewport at `z-index: 9999`).

### Rotating back to landscape

`OrientationGuard` listens for `resize` and `orientationchange`. The moment
the device is landscape again:

1. The overlay is removed.
2. `EventBus` emits `orientation:restored`.
3. Anything that owns viewport-dependent layout (desktop icon grid, open
   windows, taskbar) can listen for `orientation:restored` to recalculate —
   the same way they already react to `responsive:changed` from
   `ResponsiveMode`.

## Responsive Behavior Is Preserved

`OrientationGuard` does not replace or modify `ResponsiveMode`,
`WindowManager`, or `DesktopManager`. Landscape becomes an *additional
minimum requirement* layered on top of the existing responsive desktop —
once in landscape, the existing phone/tablet/desktop responsive rules apply
exactly as before.

## Boot Order

`OrientationGuard.initialize()` runs immediately after the workstation root
element is created — before the theme, boot screen, or desktop mount — so a
portrait phone is blocked as early as possible rather than flashing the
desktop first. See the boot sequence comment at the top of
`core/Workstation.js`.
