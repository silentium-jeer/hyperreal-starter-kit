---
name: ui-kit-architecture
description: >-
  Build and evolve reusable UI for this kit's HTML/CSS UI (React in dev/ui,
  shown by CEF: a game's HUD over its scene, and the dev shell's page with the
  UI kit in dev/ui/features/ui-kit). Use when creating or changing reusable UI
  primitives, menus, HUD controls, dialogs, sliced frames, UI asset placement,
  or when deciding whether a panel should compose shared primitives rather than
  own another copy. Covers who may talk to the game (panels, through bridge.ts),
  the data-hit input contract, asset placement, isolation and visual acceptance
  inside the running game.
---

# UI Kit Architecture

In the web kit, `features/ui-kit` was an isolated feature that owned reusable
visual primitives, while screens composed them and owned routing and game
actions. The same split applies to this kit's UI, which lives in `dev/ui/` and
is two pages:

- **A game's HUD** — `hud.html` + `hud.tsx`, the page each game process draws
  over its own scene (`dev/src/app/ui-host.ts` shows it through `UVgeUI`). It
  renders nothing yet; a game puts its own HUD there.
  - `bridge.ts` — the HUD's only channel to the game: `post(message)` sends,
    `onGameMessage(listener)` receives, `inGame()` says whether the CEF binding
    (`window.ue.vge`, `UVgeUI`) exists.
  - `styles.css` — the HUD's stylesheet.
  - The game side is `dev/src/app/ui-host.ts`; it handles no HUD message yet.
- **The dev shell's page** — `index.html` + `main.tsx` → `App.tsx` →
  `app/router/AppRouter.tsx`, the web-starter-kit app shown by the C++ shell
  (`npm run shell`, `shell/src`) under its title bar (`shell/WindowChrome.tsx`:
  Main scene / Labs / UI kit). `/` is the main scene and `/labs/<id>` a lab, each
  a game process of its own under `<GameWorld>` (`features/world`); `/labs` is
  the lab index (`app/labs/*`, `app/ui/labs/LabsScreen.*`); `/ui-kit` is the
  gallery. It talks to the shell, not to a game, through `shell/bridge.ts`.
- **The UI kit** — `features/ui-kit`, the web kit's isolated primitives feature:
  `components/<Name>/` (`ControlPanel`, `ControlButton`, `ControlSlider`,
  `LabCard`, `Patch9Button`, `PauseMenu`, `TouchActionButton`, `VirtualStick`,
  …), each with a co-located `preview.tsx`, exported from `index.ts`, and the
  gallery `UiKitGallery`. Today the shell page uses it (`LabCard` in the lab
  index); the HUD does not use it yet.

The rules below say how primitives are built and composed.

## Ownership

- A reusable primitive lives in the kit, `dev/ui/features/ui-kit/components/<Name>/`,
  separate from the screens and panels that use it. It imports only shared UI
  code (`dev/ui/shared`) and its own files; it never imports a panel, the bridge,
  or game-specific copy.
- A primitive receives data and callbacks through props. It must not `post()` to
  the game, subscribe to game messages, or decide panel-specific copy.
- Keep a primitive's styling, sliced art and assets private to its directory;
  export only the component (through `features/ui-kit/index.ts`).
- Each panel assembles its UI from primitives. The panel owns the game messages
  (`post`, `onGameMessage`), the labels and its layout composition.

## One input contract owns the whole overlay

The HUD page is a transparent overlay over the game. **The game routes the cursor
to the page only over the rectangles of elements marked `data-hit`; everything
else on screen stays the game's** (`bridge.ts` reports those rectangles to the
game on every DOM mutation and resize). The shell's page is not under this
contract: it is an ordinary page, and over a `<GameWorld>` box the world's own
window takes the mouse.

- Every interactive element of the HUD must be inside an element with `data-hit`
  (nothing in the HUD carries one yet, because it is empty). A control outside
  one renders but can never be clicked.
- Do not put `data-hit` on a full-screen backdrop or scrim unless it is meant to
  take the whole screen's mouse input away from the game.
- Decorative art that overlaps the game but takes no input stays outside
  `data-hit` regions.
- The web kit's rule "one scaler owns the entire runtime UI — never portal out of
  it" applies unchanged the day the HUD adds a UI scaler. It has none today. (The
  kit's `DemoSceneHud` wraps itself in `ScalableContainer` from
  `@vibegameengine/ui-scaler` with `shared/lib/ui-scale/useResponsiveTargetWidth`,
  but no page mounts it.)

## Co-locate assets with their consumer

Never create an `assets/` bucket merely to store images. Place every UI asset
beside the narrowest component that imports it:

```
dev/ui/<primitive-owner>/
  MenuButton/
    MenuButton.tsx
    assets/
      menu-active.png
      menu-default.png
      menu-disabled.png
  MenuPanel/
    MenuPanel.tsx
    assets/
      menu-panel.png
```

- A button state image belongs in that button component's `assets/` directory.
- A panel frame belongs in the panel component's `assets/` directory.
- A panel-only image belongs beside that panel.
- Import assets statically from their owner so Vite serves them with the page.
- Only create a shared asset owner when the asset is itself a real shared
  primitive with two or more consumers. Never create an unowned `assets/` bucket
  "for later".

The kit already follows this: `DanceControl`'s frame lives in
`features/ui-kit/components/DanceControl/assets/`. A game feature's `assets/`
folder (`dev/src/features/<slice>/assets/`) is not a UI asset folder: a model
file there that game code imports becomes 3D content through the content
pipeline.

## Workflow

1. Check whether the requested UI repeats across panels. If not, build it in the
   panel.
2. If it repeats, create one primitive with a narrow prop contract.
3. Co-locate its CSS and assets in the primitive's directory.
4. Keep sliced images, source insets, border insets and disabled state inside the
   primitive; callers choose intent (`variant`, `disabled`, callbacks), not
   texture files or atlas coordinates.
5. Let panels compose the primitive and supply their own game messages.
6. Give every interactive element a stable `data-testid` (`ui-test-ids`), so
   `node tools/ui.mjs click '[data-testid="…"]'` finds it by identity.
7. Verify in the running game (below).

## Mandatory isolated visual gate

Never accept a UI component from source inspection, `node tools/ui.mjs text`, a
build, or a frame of a desktop browser alone. Opening `/ui/hud.html` directly in
a desktop browser is fine for iteration — the bridge logs the posts it would have
sent — but it is not the surface the player sees.

- **Isolated preview:** every visible kit element has its own id and a
  co-located `preview.tsx` (`uiKitPreview: { id, title, description, render }`,
  `features/ui-kit/systems/uiKitPreview.ts`), discovered recursively by the
  gallery (`UiKitGallery`, `import.meta.glob('../**/preview.tsx')`) at
  `/ui-kit/<id>` of the shell page (`npm run shell`, "UI kit"), with
  deterministic self-contained props. A new primitive gets its `preview.tsx` in
  the same change.
- **Acceptance surface:** the page the element ships in, inside CEF: a HUD
  element over the rendered game (`npm run play`, windowed; it passes
  `-cefdebug=9222`, the default endpoint of `tools/ui.mjs`), a shell element in
  the shell's page (DevTools on 9221, `VGE_CDP=http://127.0.0.1:9221`). Drive
  every state with `node tools/ui.mjs click | select | eval`, read the page
  console with `node tools/ui.mjs console`, capture the window and look at it.

### Hard gate for composite UI

For atlas-driven menus, HUDs, trees, dialogs, or any UI made from more than one
visible element, the order is mandatory:

1. Identify every visible element before coding: outer frame/backdrop, header,
   every panel, button state, icon/node, connector and decorative state.
2. Implement each element as an independently renderable component with an
   intrinsic size. The assembly owns only positioning and data wiring; a part
   must not rely on the assembly's absolute coordinates to render.
3. Give every part its own isolated look before assembling (its own
   `preview.tsx` in the gallery). A blank frame, backdrop and disabled button are
   still elements.
4. Inspect every part with eyes in the game window. Click every interactive part
   and verify default, active, pressed, disabled and impact states it supports.
5. Only after all parts pass, assemble the composite and inspect it, then the
   consuming panel.

Do not use a single large shell, full-composition screenshot, CSS rectangle, or
unframed black filler to hide missing parts.

### Mandatory visual checkpoint — every UI change

Before starting a second visual change, take a fresh capture of the game window
and pass every item below against the reference. A failed item blocks further
work. Do not treat DOM bounds, a build, or `tools/ui.mjs text` as visual
evidence.

- **Silhouette and seams:** header, frame, panels and dividers touch exactly as
  in the reference. Reject any transparent gap, detached cap, overlap, doubled
  edge, stretched corner or mismatched outer silhouette.
- **Inventory and construction:** every reference icon, ornament, state and
  connector appears once at its intended anchor. Build panels from semantic
  parts; never put a real control over a baked control in a whole-panel PNG.
- **Geometry and hierarchy:** compare intrinsic sizes, column gaps, anchors,
  crop, selected icon/ring, title, dividers, copy and action order. For trees,
  enumerate every node and connector at explicit coordinates.
- **Interaction and input:** every visible action has exactly one semantic
  control with visible disabled, focus and pressed states, inside a `data-hit`
  region, and the game still receives the mouse everywhere else.
- **Evidence:** retain the capture used for the decision in `wip/<task>/` and
  state the reference mismatch it proves fixed.

### Reference preparation

When a UI task has a visual reference, prepare it before changing the
implementation: identify the exact component bounds, crop only that composition,
inspect the crop, and label it `reference-only`. It is validation material, never
a replacement panel asset. The web kit's overlay/heatmap control and its
`window.__uiKitPixelDiff` console API were ported with the kit
(`PixelDiffInspector`, `features/ui-kit/systems/pixelDiff.ts`
`installPixelDiffAgentApi`), but nothing mounts the inspector or installs the API
yet, so comparing a capture against the reference is done on the captures until
something wires them in.

## Decompose every element into atomic layers

**No visible element may be one baked composite image.** Every element is built
bottom-up from its smallest constituents, each a separate layer/asset. Then, and
only then, assemble.

- A skill node is **not** one picture. It decomposes into the medallion/socket
  ring, the coloured energy fill, and a **bare glyph** (the symbol alone, on a
  fully transparent background) layered on top.
- The same applies to buttons (frame slice + label), panels (frame slices +
  content), the header (frame + separate nav icons), badges, and connectors.
- A parent only positions its children, it never bakes them.
- You cannot recolour, reskin, animate, or state-swap a layer fused into a bigger
  picture, and fused art can never pixel-match the reference.

Work strictly from particular to general: atomic layer → element → column →
panel.

## Never fake painted graphics with `border-image`

Never use `border-image` (or a plain CSS `border`) to stand in for a painted,
sliced graphic — a frame, ornament, medallion, socket, or any decorated edge.
Render them from their real sliced image assets, 9-sliced when a corner/edge must
not stretch (`patch9-ui`).

This ban is narrow. Ordinary `border` (a genuine hairline divider — the current
panels use one), `outline` (`:focus-visible` rings) and `box-shadow` remain fine
for what they actually are.

## Do not do this

- Do not let a primitive `post()` to the game or listen to game messages.
- Do not place an interactive element outside a `data-hit` region.
- Do not fake a painted frame/ornament/socket with `border-image`.
- Do not duplicate a generic button/panel in a panel once a primitive owns it.
- Do not store UI images in a game feature's `assets/` folder or in an unowned
  bucket.
