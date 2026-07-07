# Aquerra Prototype Handoff

Last updated: 2026-07-07

## Purpose

Aquerra is a Phaser/Vite/TypeScript prototype for a water-jet puzzle game. The current rework build is a procedural playtest: generate a basin, spend a shared power budget on wall-mounted jets/tools and water-placed bombs, aim placed jets, push the tuber into the goal, then auto-generate the next basin.

## Workspace

```text
/Users/darylsmith/Documents/Aquerra
```

Run locally:

```bash
./run-dev.sh
```

Build-check:

```bash
CI=true PATH=/Users/darylsmith/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/darylsmith/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin:$PATH /Users/darylsmith/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/pnpm run build
```

Do not assume system `npm`/`pnpm` exists; earlier it was unavailable. `run-dev.sh`
now exports `CI=true` before running pnpm so it does not pause on non-interactive
module-purge prompts.

## GitHub / Netlify

GitHub:

```text
https://github.com/dazreil/aquerra
```

Rework GitHub repository for A/B testing:

```text
https://github.com/dazreil/aquerra-rework
```

Live Netlify site:

```text
https://aquerra.netlify.app
```

Netlify is synced to GitHub. Normal deploy flow is:

```bash
git add .
git commit -m "Describe change"
git push
```

Netlify then auto-builds from GitHub.

Latest pushed commit at handoff:

```text
6e7a4dd Pause flow while aiming jets
```

Local status at handoff:

```text
codex/pressure-jet-rework, with local uncommitted Jet/Bomb/Bouncer power rework changes
```

GitHub CLI is authenticated as `dazreil`; `gh auth setup-git --hostname github.com`
was run so HTTPS pushes can use the GitHub CLI credential helper. The `rework`
remote points at `https://github.com/dazreil/aquerra-rework.git`; push the rework
prototype there when ready, leaving `origin` as the original A/B baseline repo.

## Important files

- `src/main.ts` — all Phaser rendering, gameplay simulation, procedural generator, inventory, collision, win loop.
- `src/styles.css` — responsive layout and compact side panel styling.
- `index.html` — minimal visible UI plus hidden default config inputs.
- `netlify.toml` — Netlify build config.
- `run-dev.sh` — local dev runner using bundled Codex runtime.
- `PROJECT_STARTUP_CHECKLIST.md` — reusable checklist for future projects.

## Current visible player-facing UI

The visible side panel is intentionally simple:

- title/help text
- action section:
  - Add jet
  - Remove jet
  - Start/Pause flow
- procedural basin section:
  - seed input
  - Generate level
  - Dice seed
  - generator status
- debug/readout panel

The old sliders, tuning panels, selected-jet editor, and basin-size controls are hidden/removed from the visible UI for this playtest version. Hidden inputs still exist in `index.html` to provide internal default values expected by existing code.

## Current gameplay

- A procedural basin auto-generates on load.
- The tuber starts in generated water.
- The goal is generated at a reachable far water tile.
- Player selects Jet P1-P4, Bomb P1-P4, or Bouncer from the `Jet stock` inventory drawn below the basin.
- Player spends from a shared 12-power budget instead of per-type charges.
- Jet cost equals power level; angled Jet shots cost an additional 2 power.
- Bomb cost is 3 power per level; Bouncer costs 8 flat.
- Player uses Add jet to place Jets/Bouncer on valid wall/water edges.
- Bombs are placed directly on water cells and create a radial ripple from that tile.
- In Add mode, tapping an existing jet cycles its aim through -45, -22, 0, 22, and 45 degrees.
- Flow starts paused so the player can place and aim jets before the tuber moves.
- Pressing Start flow runs jet forces; pausing stops new jet force/decay but lets the tuber coast down under drag.
- Adding, removing, or re-aiming a jet pauses flow again without hard-stopping existing tuber velocity.
- Player uses Remove jet to prevent accidental placement while deleting jets.
- No jets are auto-placed at the start.
- In Remove mode, clicking an existing jet deletes it and frees its power cost.
- Jets decay and retire using gameplay cutoffs.
- Pushing the tuber into the green goal triggers a win state:
  - status says the player won
  - after a short delay, the next seed is generated automatically.

## Current procedural generator

Implemented in `src/main.ts`.

Features:

- deterministic seeded generator
- 10×10 water mask
- irregular room/blob carving
- channel carving between generated chambers
- at least one loop when possible
- flood/reachability validation
- checksum validation logged to console
- generated level name
- start/goal placement
- valid jet-slot detection
- no starter jets placed automatically

Relevant functions/types:

- `GeneratedLevel`
- `generatePuzzleLevel(seed)`
- `generatePuzzleLevelOnce(...)`
- `createRng(seed)`
- `carveBlob(...)`
- `carveChannel(...)`
- `floodMask(...)`
- `jetSlotsFromMask(...)`

## Current mechanics

Tuber:

- simulated as a circle-ish sampled point
- reduced water drag for more inertia
- wall collision
- higher bounciness for stronger rebound
- blocked wall movement explicitly pushes the tuber away from the wall with a small minimum rebound speed
- small corner-slide helper for corner pinches

Jets:

- Jet and Bouncer are edge-mounted on generated walls
- Bombs are water-cell placed and do not need a wall mount
- base direction points from wall into adjacent water for edge-mounted tools
- limited-angle aim offsets on placed Jets/Bouncer
- shared 12-power budget
- three behavior types:
  - Jet: straight force; power levels 1-4; Power 4 straight is anchored to the old Push Jet feel
  - Bomb: radial ripple force away from its water-cell landing point; cost 3 per power level; P4 is tuned to roughly a four-cell-wide ripple with light follow-through; force levels are 2.2/3.6/4.8/5.8
  - Bouncer: strong 10-cell launch stream; flat cost 8
- placed tools show a four-segment circular power marker
- deleted/expired/invalidated jets refund power by being removed from the board

Jet retirement:

- range <= 0.75 tile, or
- power <= 16% of base, or
- visual energy <= 18%, or
- stream width <= 0.12 cell

## Known issues / likely next work

1. Inventory is still drawn inside Phaser canvas:
   - it now sits directly below the active south wall so shorter/generated basins do not leave a large vertical gap
   - but for web/mobile UX, it may eventually be better as HTML UI outside the canvas.

2. Jet rework needs tuning:
   - power costs, stream widths, decay rates, Bomb ripple strength/radius, and Bouncer launch strength are first-pass values
   - next pass should playtest whether Jet/Bomb/Bouncer are distinct and understandable.

3. Collision can still be awkward at wall corners:
   - current axis-split movement plus corner-slide is a patch
   - better long-term fix: circle-vs-solid-cell collision normal solver.

4. Generator is useful but simple:
   - currently 10×10 only
   - no real difficulty progression yet
   - no proof that generated levels are solvable with available power, only that water is connected and jet slots exist.

5. Win state is simple:
   - it updates text and generates next seed
   - no modal/animation yet.

## Suggested next prompt

Use this in a new thread:

```text
Read /Users/darylsmith/Documents/Aquerra/SESSION_HANDOFF.md and continue from there.

First, inspect the current app and suggest the next smallest playable improvement.
```
