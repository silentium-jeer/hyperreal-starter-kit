---
name: world-debug-seam
description: >-
  Verify a game mechanic by driving it through the DEV debug seam
  (node tools/game.mjs -> dev/src/app/debug-seam.ts), never by playing the world
  by hand. MANDATORY before checking any mechanic that lives somewhere in a
  world — loot that spawns at a site, a pickup, an interaction, damage, death,
  an escalation stage, a weather or time-of-day state, an objective that ticks.
  Enforces: build the tool first (teleport, set state, force the event, strip
  the layer that is in the way), read the state as numbers, then look at frames
  from those positions. Trigger on- "check that it works in the game", "walk to
  X and see", "can the player pick it up", "it only happens after N minutes",
  "reach the far site", "the enemies kill me before I get there", "scripted
  walkthrough", "e2e run", "hold W and see", "verify the loop end to end",
  "tools/game.mjs".
---

# Debug the world with tools, not with your feet

Verifying a mechanic is not an end-to-end test. An e2e test asks "can a user get
from the front door to the receipt". A mechanic check asks "**does this thing
exist, is it reachable, does it do what it claims**" — and every metre walked to
reach it is time spent proving something nobody asked about.

The moment a check needs the world to be in a particular state, the answer is a
TOOL, not a longer script.

## The rule

**Never verify a mechanic by simulating a player.** No scripted WASD routes, no
timed legs, no "hold forward for 7 seconds and hope". Use the DEV seam to put the
world into the state under test, read the state back as numbers, then look at
what the frame shows.

Symptoms that you are on the wrong path — every one of these is a signal to stop
scripting and write a tool instead:

- the check walks a long distance to reach the thing under test;
- the route needs retries, "nudges", or per-run timing tuning;
- hostiles/hazards/timers kill the run before the thing under test happens;
- the check waits for a state the world produces rarely, or on its own schedule;
- the run must be repeated because the game reloaded, the frame rate changed, or
  a colleague's edit landed mid-run (every save under `dev/src` hot-reloads the
  running game);
- you are reading the same failure ("never got there") more than twice.

A route that fails is not evidence about the mechanic. It is evidence about the
route — and nobody is reviewing the route.

## The seam this kit has

```
node tools/game.mjs "<expression>" [timeoutMs]      (run from dev/)
  -> POST http://127.0.0.1:5173/__vge/eval          (dev/server.mjs, evalPlugin)
  -> every connected game process                      (Vite hot channel, event vge:eval)
  -> dev/src/app/debug-seam.ts evaluates it with UE, puerts, world, gameInstance in scope
  -> one JSON result per process: #0, #1, ...
```

```bash
node tools/game.mjs "UE.GameplayStatics.GetPlayerPawn(world, 0).K2_GetActorLocation()"
```

- The expression may be async. Engine objects come back described
  (`describe()` in `debug-seam.ts`): vectors as their `ToString()`, objects as
  `Class Name`.
- **It answers from every connected process.** A windowed game and a headless lab
  attached to the same dev server both answer; know which `#n` is which before
  reading a number (`VGE_PORT` selects another server).
- It listens on `import.meta.hot`, so it is live only while the game is connected
  to the dev server, and it is mounted once per program start by `dev/src/main.ts`.

That gives the **snapshot** half of a seam for free: any engine value, read as a
number, without guessing it from a frame (AGENTS.md rule 2b).

## The verbs half

A raw expression is not a verb. The web kit's seam exposed verbs a check
actually wants to say:

```ts
type WorldDebugApi = {
  teleport: (x: number, z: number) => void   // position only — everything else stays as it is
  damage: (amount: number) => void           // the discrete effect a real source would apply
  kill: () => void                           // the verb a check means, not "a number that happens to be lethal"
  escalation: (value: number) => void        // an irreversible stage set directly, so its far end is reachable
  snapshot: () => RuntimeSnapshot | null     // the last published runtime state, to assert instead of guess
}
```

**This kit has no named verbs yet.** When a mechanic needs one, add it once,
by name, to the seam's scope in `dev/src/app/debug-seam.ts` — not as a long
expression pasted into every check, which is a scripted walk written in a
different place.

Three properties make a verb trustworthy, and all three are non-negotiable:

1. **It only feeds what the runtime already consumes on its own tick.** Nothing
   writes simulation state from outside behind the systems' backs. A world
   driven from the seam must advance exactly as a played one does (gameplay here
   runs in `everyFrame`, `UVgeGameInstance.OnTick`), or the check proves
   nothing about play.
2. **It is DEV-only and unreferenced in production paths** — reachable only
   through the dev server's hot channel, never imported by gameplay code.
3. **It names verbs, not internals.** `kill()` and `teleport(x, y)` survive a
   refactor; poking a health field or a component transform from the command
   line does not.

## Strip the layer that is in the way

The second half of the seam is a set of DEV switches that REMOVE what stands
between you and the mechanic. Each one drops a layer and is named for what it
turns off. In the web kit they were query flags; here a switch is a game
command-line option, read the way `-Scene=` is read in `dev/src/app/scenes.ts`
(`KismetSystemLibrary.ParseParamValue`), or a seam verb:

- hostiles/pressure off — so loot, routes and interactions can be inspected
  without a fight the check never asked about;
- hazards/weather/time forced to a chosen state;
- ground/terrain flattened, fog or post disabled — when they hide the thing;
- an inspection camera free of the gameplay rig, so a site can be orbited
  (`viewFrom(camera)` in `dev/src/shared/engine/world.ts` makes any camera actor
  the view).

If a check keeps dying, drowning, or timing out on its way to the subject, the
missing piece is a switch, not more patience.

## The order of work

1. **Name the mechanic and its observable claim.** "The ordered item spawns at
   the site, is visible, can be taken, and lands in the pack." Not "the loop
   works".
2. **List the states you must reach** to see that claim: at the site, item
   spawned, item in the pack, item carried out.
3. **Check the seam covers them.** Missing verb or switch → write it FIRST. This
   is part of the task, not a detour.
4. **Drive the world into each state** through the seam.
5. **Read the state as numbers** with `node tools/game.mjs` in each state.
6. **Capture and LOOK at a frame in each state** from a rendered window
   (`npm run play`, AGENTS.md rule 1). The claim is about what the world shows;
   the seam only gets you there. A `-nullrhi` process answers step 5, never
   step 6.

## Judging a site, not just a flag

When the subject is placed in a world (loot, an interaction point, a spawn), the
frames must answer placement questions, and a single capture from one angle
answers none of them:

- is it **occluded** — inside geometry, behind a wall, under a roof, in a slot
  the camera cannot see into?
- does it **read** at gameplay distance and gameplay camera, not only in a
  close-up?
- can the player **stand where the interaction needs them to stand**?
- is it reachable from every side, or only from one lucky approach?

Teleport to each side of it and capture all of them. Occlusion is invisible from
the angle the author happened to pick.

## Anti-patterns

- Scripting a walk because the verb is missing. Write the verb; it is minutes.
- Clicking the game window to "focus" it before sending keys — in aim-relative
  controls this silently redefines what the movement keys mean, and every route
  after it is unreproducible.
- Treating a dead run as a finding about the mechanic.
- Verifying a mechanic in unit tests only and calling the mechanic proven — a
  pure-domain test cannot see occlusion, a missing model, or an unreachable spot.
- Reading a number from the wrong process because two were connected.
- Building the verb and then still walking, because the script already existed.
- Leaving a verb undocumented: an undiscoverable tool gets rewritten as another
  scripted walk by the next person.

## Checklist

- [ ] The claim under test is written as an observable sentence.
- [ ] Every state it needs is reachable through a seam verb or switch.
- [ ] The verbs only feed the runtime's own tick, and are DEV-only.
- [ ] Layers that block the subject can be switched off.
- [ ] The state was read as numbers with `node tools/game.mjs` in each state,
      from the right process.
- [ ] A frame from a rendered window was captured AND looked at in each state,
      from more than one side.
- [ ] No step of the check depends on walking, timing, or luck.
