---
name: mobile-ui-scaling
description: >-
  How UI scaling is done in this kit, carried over from the web kit's mobile
  scaling rule. The web kit scaled every UI screen with one external scaler
  (ScalableContainer: fixed logical targetWidth, transform scale down to fit) and
  fixed phones by a DYNAMIC targetWidth per device class — never by removing the
  scaler, never by per-element transform compensation, never by a second scaling
  system. This kit targets Win64 and its in-game HUD page (dev/ui/hud.tsx, CEF)
  has no scaler yet; the rule maps to game window resolutions. MANDATORY whenever a
  panel is "too small / too big / does not scale" at some resolution, when
  adding a UI scaler, or any responsive work on dev/ui. Trigger on: "UI too small
  at 4K", "doesn't scale", "responsive", "resolution", "targetWidth",
  "ScalableContainer", "adaptive UI", "HUD too big", "mobile UI",
  "меню не скейлится".
---

# UI scaling — one scaler, a target per resolution class, verified by eye

## Where this kit stands

- The kit builds and packages for **Win64** only (README, "Build and package").
  There is no phone target, so the web kit's portrait-phone case does not arise
  here.
- The in-game UI is the HUD page (`dev/ui/hud.html` + `hud.tsx`), empty today,
  with one global stylesheet (`styles.css`: box sizing, a transparent full-size
  root). **The HUD has no UI scaler.** The kit has no in-game control for
  resolution or window mode; a game window's size is set when it starts
  (`npm run play -- --width <w> --height <h>`, default 1280×720).
- The dev shell's page (`dev/ui/main.tsx`) carries the web kit's pieces: the
  `ScalableContainer` package (`@vibegameengine/ui-scaler`) and the shared hook
  `dev/ui/shared/lib/ui-scale/useResponsiveTargetWidth.ts`; one kit component,
  `DemoSceneHud` (`dev/ui/features/ui-kit`), uses them, and no page mounts it.
- What carries over is the rule's shape: when UI must keep its proportions
  across sizes, there is ONE scaling system for the whole page, and the fix for a
  size class that looks wrong is that system's target for that class.

## The web kit's system (the pattern this kit adopts when it scales)

Every UI screen was wrapped once in `ScalableContainer`: one
`position:absolute; transform-origin:top-left` element, a logical canvas of
`targetWidth`, and `scale = min(1, innerWidth / targetWidth)` — it only ever
scaled DOWN. UI was authored in large logical pixels and shrunk to fit.

A screen that collapsed on a phone had a desktop `targetWidth` hard-coded
(390 / 1280 ≈ 0.30 — everything at 30%). The ONE correct fix was a dynamic
`targetWidth` per device class from one shared hook, so a narrow screen kept its
on-screen scale near 1:

```tsx
const targetWidth = useResponsiveTargetWidth({ desktop: 1448, mobilePortrait: 640 })
<ScalableContainer targetWidth={targetWidth} zIndex={2}>
```

Only screens that were genuinely broken got a smaller target; a screen that
already looked right kept the same value for both classes. A screen with more
elements needed a larger target than a sparse one, tuned by eye, not by formula.

**Here:** `ScalableContainer` and `useResponsiveTargetWidth` exist (see above)
but the HUD does not use them. When the HUD needs to scale with the game
resolution, wrap the whole page once in `dev/ui/hud.tsx` with that scaler, and
pick the target per resolution class in that one shared hook. Nothing else.

## Forbidden (the "костыли с обратным scale")

- ❌ Per-element compensation like `.panel { transform: scale(2) }` to "un-shrink"
  one panel. If a panel is the wrong size at a resolution, the page's target for
  that resolution is wrong — fix the target, delete the hack.
- ❌ A second scaling system next to the first, or a panel that opts out of the
  scaler by being rendered outside it.
- ❌ Duplicating the target-picking logic in a panel.

## Input is scale-independent — keep it that way

The game routes the mouse to the page over the rectangles of `data-hit`
elements, measured with `getBoundingClientRect()` and reported with
`window.innerWidth` (`dev/ui/bridge.ts`, `reportInteractiveRects`). A CSS
transform on an ancestor changes those rectangles, and the report follows them
on the next mutation or resize — so a scaler must not stop that report from
running (keep it reacting to `resize`), and a change of target is otherwise a
visual-only change.

## MANDATORY verification — by eye, in the game, both ends

Per AGENTS.md rule 1, never claim a layout "looks right" from a typecheck, a
build or the code.

1. **Capture a reference BEFORE you change anything** at each resolution you will
   compare, so "unchanged" can be checked afterwards.
2. Use the already-running dev server (`npm run dev`, never restarted for this)
   and a windowed game per size (`npm run play -- --width <w> --height <h>`).
3. Read the page size with `node tools/ui.mjs eval "[innerWidth, innerHeight]"`
   so each capture is labelled with the size it was taken at.
4. Capture the game window into `wip/<task>/`, **open the image and look**.
   Verify the smallest and the largest supported resolution AND that the
   resolution you did not intend to change is unchanged.

Related skills: `patch9-ui` (framed elements follow element size),
`ui-kit-architecture`, `fsd-ecs-architecture`.
