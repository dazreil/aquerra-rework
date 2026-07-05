# Aquerra Prototype Handoff

Last updated: 2026-07-05

## Project

Simple Phaser/Vite/TypeScript mechanics prototype for testing the Aquerra water-jet/tuber idea.

Workspace:

`/Users/darylsmith/Documents/Codex/2026-06-20/w`

Run:

```bash
./run-dev.sh
```

Build-check command used by Codex:

```bash
CI=true PATH=/Users/darylsmith/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/darylsmith/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin:$PATH /Users/darylsmith/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/pnpm run build
```

## Current prototype features

- Barebones flat grid/water/wall view.
- Water shape editor:
  - Water columns/rows sliders set max water area.
  - Wall-integrated arrow controls adjust individual row widths and column heights.
  - Walls are generated around water and are not counted as water tiles.
- Tuber:
  - Right-click or shift-left-click water to move tuber.
  - Tuber has velocity, drag, wall collision, bounciness, and goal detection.
  - Current collision uses outer-edge sampling plus a small corner-slide helper.
- Jets:
  - Jets are mounted on wall/water edges, not inside wall cells.
  - Jet direction comes from the water-adjacent side of the wall.
  - Hovering an edge previews the jet stream.
  - Left-click edge places selected stock jet.
  - Left-click existing jet deletes it and starts recharge.
  - Right-click existing jet restarts it and selects it.
  - Selected jet can have sliders applied to update base power/range/width/decay.
  - Jets decay over time and retire early using gameplay cutoffs:
    - range <= 1 tile, or
    - power <= 8% of base, or
    - visual energy <= 8%, or
    - stream width <= 0.12 cell.
- Jet stock inventory:
  - Right side of game canvas.
  - Four preset jet types: Gentle stream, Strong blast, Wide push, Bouncy lab.
  - 3 charges of each.
  - Deleting/expiring/invalidating a jet starts a 5-second recharge.
- Goal:
  - Green target on water.
  - Alt-click water to move the goal.
- Debug:
  - Toggleable force/range overlay.
  - Readout includes water shape, tube state, jet counts, stock, selected stock, selected jet, cutoff info.
- Side panel:
  - Main sliders for tuning.
  - Slider range editor for tuning slider min/max values.
  - Quick preset buttons.
  - Procedural basin generator with seed/dice controls.
  - Selected jet controls.
  - Reset tuber / clear jets / reset shape / reset goal.
- Procedural generator:
  - Deterministic seeded 10×10 basin generator.
  - Creates irregular water masks, start, goal, edge jet slots, and 1–3 starter jets.
  - Runs reachability/checksum validation and reports stats in the side panel/readout.
  - Generated masks can be cleared by manual wall-arrow edits.

## Important files

- `src/main.ts` — all prototype logic/rendering.
- `src/styles.css` — side panel styles.
- `index.html` — side panel controls and help text.
- `run-dev.sh` — runs Vite using bundled Codex runtime because local `npm/pnpm` were unavailable.

## Current known issue / next likely work

The tube can still get awkward around wall corners. The latest fix restored straight-on wall bounce and only attempts corner-slide when there is tangential force/motion or an asymmetrical corner pinch. If it still sticks, next likely step is replacing the current axis-split collision with a more proper circle-vs-solid-cell collision normal solver.

## Recent implementation note

Do not assume globally installed `npm`/`pnpm` exists. Use `./run-dev.sh` or the bundled pnpm path in the build command above.

## Netlify deploy

Latest Netlify deploy updated on 2026-07-05:

- Site URL: `https://glittering-seahorse-19f7fb.netlify.app`
- Site ID: `f74c3bf2-b8e6-4acd-806c-e2c4fffc602f`
- Deploy ID: `6a4a83f8b152603168a57199`
- Status check: HTTP 200 after authenticated deploy.

Previous anonymous deploy:

- `https://genuine-pasca-3becae.netlify.app`

This deploy has been claimed into the user's Netlify account. Future updates should deploy to the same site ID above.
