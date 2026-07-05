# Aquerra Prototype Handoff

Last updated: 2026-07-06

## Purpose

Aquerra is a Phaser/Vite/TypeScript prototype for a water-jet puzzle game. The current build is a simplified procedural playtest: generate a basin, use limited jet stock to push the tuber into the goal, then auto-generate the next basin.

## Workspace

```text
/Users/darylsmith/Documents/Codex/2026-06-20/w
```

Run locally:

```bash
./run-dev.sh
```

Build-check:

```bash
CI=true PATH=/Users/darylsmith/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/darylsmith/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin:$PATH /Users/darylsmith/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/pnpm run build
```

Do not assume system `npm`/`pnpm` exists; earlier it was unavailable.

## GitHub / Netlify

GitHub:

```text
https://github.com/dazreil/aquerra
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
f70b36c Remove auto-placed starter jets
```

Local status at handoff:

```text
main...origin/main
```

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
- Player selects a jet type from the in-canvas `Jet stock` inventory.
- Player places jets on valid wall/water edges.
- No jets are auto-placed at the start.
- Left-click existing jet deletes it and starts recharge.
- Right-click existing jet restarts it.
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
- water drag
- wall collision
- bounciness
- small corner-slide helper for corner pinches

Jets:

- edge-mounted on generated walls
- direction points from wall into adjacent water
- four stock types:
  - Gentle stream
  - Strong blast
  - Wide push
  - Bouncy lab
- 3 charges of each
- deleted/expired/invalidated jets recharge after 5 seconds

Jet retirement:

- range <= 1 tile, or
- power <= 8% of base, or
- visual energy <= 8%, or
- stream width <= 0.12 cell

## Known issues / likely next work

1. Controls are still mouse-first:
   - left-click/right-click assumptions remain
   - next pass should add explicit touch-friendly action buttons: Place, Delete, Restart.

2. Inventory is still drawn inside Phaser canvas:
   - works visually
   - but for web/mobile UX, it may be better as HTML UI outside the canvas.

3. Collision can still be awkward at wall corners:
   - current axis-split movement plus corner-slide is a patch
   - better long-term fix: circle-vs-solid-cell collision normal solver.

4. Generator is useful but simple:
   - currently 10×10 only
   - no real difficulty progression yet
   - no proof that generated levels are solvable with available jet stock, only that water is connected and jet slots exist.

5. Win state is simple:
   - it updates text and generates next seed
   - no modal/animation yet.

## Suggested next prompt

Use this in a new thread:

```text
Read /Users/darylsmith/Documents/Codex/2026-06-20/w/SESSION_HANDOFF.md and continue from there.

First, inspect the current app and suggest the next smallest playable improvement.
```

