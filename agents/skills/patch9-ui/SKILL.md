---
name: patch9-ui
description: >-
  Build, slice, and repair framed game UI (9-slice / Patch9 frames and buttons)
  in this kit's HTML UI (dev/ui, React, shown by CEF: a game's HUD over its
  scene, and the dev shell's page). Use
  whenever creating or changing a HUD, main menu, modal, panel, framed button,
  UI atlas crop, or an overlay element that must stay clickable over the game.
  Covers placement, asset slicing, slice/border insets, the data-hit input
  contract, interaction rules, and verification inside the running game.
---

# Patch9 UI — sliced frames, real interactions

Every framed button and panel is drawn by one isolated renderer,
`Patch9Button` / `Patch9Surface` in the UI kit
(`dev/ui/features/ui-kit/components/Patch9Button/`, drawing through
`dev/ui/shared/lib/patch9/patch9ImageRenderer.ts`, config type `Patch9Config` in
`dev/ui/shared/lib/patch9/Patch9.types.ts`), ported from the web kit; screens
compose it without owning image or inset details. Its isolated look is its
`preview.tsx` in the gallery (`/ui-kit`). The rules below are the technique and
its contract. Every framed element reuses this renderer; never recreate 9-slice
drawing inside a panel.

## Workflow

1. Before adding files under `dev/ui`, load `ui-kit-architecture`; before adding
   files under `dev/src`, load `fsd-ecs-architecture`.
2. A panel lives in its page (`dev/ui/hud.tsx` for a game's HUD) and owns its
   game messages; a reusable framed control lives with the UI primitives in
   `dev/ui/features/ui-kit/components/`. Keep a UI image next to the component
   that imports it (for example `MenuButton/assets/` for button states,
   `MenuPanel/assets/` for panel art; the kit's `DanceControl/assets/`). Never put
   UI art in a game feature's `assets/` folder under `dev/src` — a model file
   there that game code imports becomes 3D content.
3. Cut an atlas into one transparent PNG per reusable state: normally default
   button, active button, disabled button, and panel. Never import runtime UI
   directly from a concepts or staging directory.
4. Configure the source slice and destination border, then lay out the panel with
   CSS Grid/Flex. Use explicit states and working actions.
5. Mark the interactive region with `data-hit`, give every control a
   `data-testid`, and verify in the running game (below).

## Choose the primitive

- An **action** is a framed `<button>`: it renders a semantic button, supports a
  disabled image (`disabledImage`), and owns hover/pressed/disabled behaviour
  (`Patch9Button`).
- A **non-interactive frame**, card or panel is a surface (`Patch9Surface`). Do
  not use it as a fake button; place a real button inside.

The call shape (`import { Patch9Button, Patch9Surface } from '<…>/features/ui-kit'`):

```tsx
const BUTTON_PATCH = {
  image: activeImage,
  slice: { top: 10, right: 15, bottom: 10, left: 15 },
  border: { top: 10, right: 15, bottom: 10, left: 15 },
  textColor: '#fae4c8',
}

const PANEL_PATCH = {
  image: panelImage,
  slice: { top: 25, right: 25, bottom: 25, left: 25 },
  border: { top: 25, right: 25, bottom: 25, left: 25 },
}

<Patch9Surface className="panel" patch9={PANEL_PATCH} data-hit>
  <Patch9Button patch9={BUTTON_PATCH} onClick={onPlay} data-testid="menu-play">
    Play
  </Patch9Button>
</Patch9Surface>
```

## Slice correctly

`slice` is the immutable pixel inset on the source art: corners and ornament that
must not stretch. `border` is the fixed target inset: choose it close to the
rendered thickness of that ornament. The center region is the only area that may
scale.

- Crop enough transparent margin to retain every corner, spike, and shadow.
- Keep `slice.left + slice.right < source width` and the same rule vertically.
- Keep `border.left + border.right < every target width` and the same rule for
  target height; otherwise the renderer falls back to a full-image stretch
  (`drawPatch9Image`), which is visible as a distorted frame — treat it as a
  bug in the insets, never as an accepted look.
- Store patch configurations as module constants. A new object every render
  defeats caching and causes needless redraws.
- The renderer draws the slices into a canvas, never with `border-image`
  (`ui-kit-architecture`), and redraws when the element's size changes (a
  `ResizeObserver`). Never add background-size hacks over the generated image.

## Make an overlay clickable

The HUD page is a transparent overlay; **the game routes the mouse to the page
only over elements marked `data-hit`** (`dev/ui/bridge.ts` reports their
rectangles to the game). The web kit restored `pointer-events: auto` inside a
scaler that disabled them; here the equivalent is `data-hit`:

- Put `data-hit` on the element that owns the interaction (a panel root), so
  every control inside it is reachable.
- Keep decorative artwork outside `data-hit` regions, so the game keeps the mouse
  there.
- Do not mark an invisible full-screen scrim `data-hit` unless it is meant to
  block the game's input.
- The cursor stays visible in the game (`ui-host.ts` sets `bShowMouseCursor`), so
  the page can be used without a mode switch.

## First reveal

The shell's page keeps its bootstrap overlay (`BootstrapGate`,
`dev/ui/features/bootstrap`) up until every mounted Patch9 canvas image has been
generated (`useReportInitialRenderReady` → `waitForPatch9ImagesReady`), so no
frame shows an unframed button. The HUD page has no bootstrap overlay; the
requirement still holds there: a framed element must never appear for a frame
without its art. Show it when its slices are ready.

## UI quality rules

- Give every primary action a real outcome: post a message the game handles, or
  show an explicit unavailable state. Do not leave dead buttons.
- Use `disabled` for unavailable actions; do not emulate it with a click that
  silently does nothing.
- Keep decorative images `alt=""`; give icon-only controls `aria-label`.
- Restore a local `:focus-visible` treatment if generic focus rings are
  suppressed.
- Never add a 3D scene just to decorate a menu. Use the supplied UI assets and
  CSS unless a scene was explicitly requested.

## Verification

1. With `npm run dev` running, start the game windowed: `npm run play` (it passes
   `-cefdebug=9222`). For an element of the shell's page, `npm run shell` (its
   page answers on 9221: `VGE_CDP=http://127.0.0.1:9221`).
2. Drive the element with `node tools/ui.mjs click '<css>'`,
   `node tools/ui.mjs select '<css>' <value>`, `node tools/ui.mjs eval '<js>'`,
   and read the page console with `node tools/ui.mjs console`.
3. Capture the window and inspect panel corners and seams; repeat at the
   smallest and the largest supported resolution
   (`npm run play -- --width <w> --height <h>`).
4. Click every button, including keyboard focus/Enter. Confirm the click reached
   the game (its log line or a `node tools/game.mjs` number) and that no
   backdrop, scrim or decorative layer intercepts it.
5. Run `npm run typecheck` before final delivery; report pre-existing failures
   separately from the UI change.
