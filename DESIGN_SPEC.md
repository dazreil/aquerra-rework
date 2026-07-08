# Aquerra Design Spec

Last updated: 2026-07-08

## Purpose

Aquerra is a water-flow puzzle game about planning tool chains that move a tuber through a basin to a goal. The current web prototype should become a level creator/tester for designing rules, layouts, and puzzle chains. The final game can later present the same level data and rules in a richer 3D/isometric style.

This document is the target design direction. Where it differs from the current prototype, this document should guide the next rebuild or refactor.

## Product Split

### Prototype / Level Creator

- 2D top-down editor/tester.
- Prioritizes readability over final art.
- Shows debug overlays, line of sight, power use, Flow Ghost prediction, tool states, and level data.
- Allows quick placement, deletion, aiming, seed generation, and replay.
- Exports/imports levels for the final game.

### Final Game

- 3D/isometric presentation.
- Uses the same core rules and level format as the editor.
- Hides most debug UI.
- Adds atmosphere, animation, polish, and progression.

## Core Loop

1. Setup the route.
2. Start flow.
3. Tools wake when the tuber enters line of sight.
4. Woken tools spend power, fire, decay, and retire.
5. The tuber either reaches the goal, naturally stops with power remaining, or naturally stops with no power remaining.
6. If stopped with power remaining, enter another setup phase from the tuber’s current position.
7. If stopped with no power remaining, reset the attempt to the original setup, but keep the player’s placed map/tools.

The player should never be punished for rearranging during setup. The puzzle is about spending power during the run, not paying to experiment with placement.

## Phases

### Setup

- Player can place, delete, move, and aim tools freely.
- Placement and deletion do not spend power.
- Clicking/tapping an existing tool removes it during setup.
- There should not be separate add/remove modes for normal play.
- Flow Ghost previews the likely route from the current tuber position.
- Tools are dormant/fresh unless they were already used in a previous run segment.
- Start flow begins a run segment.

Setup interaction should be simple:

- Pick a tool from the stock, then tap a valid location to place it.
- Tap an existing unused tool to remove it.
- Drag or use a clear aim handle to change direction where the tool supports aiming.
- Used/spent tools may remain as attempt history and should not refund power.

The editor/tester can later expose advanced selection tools, but the default player-facing interaction should avoid mode switching where possible.

### Running

- Tuber moves under inertia, fluid drag, wall interactions, and active tool force.
- Dormant tools wake only when the tuber enters their line of sight.
- Power is spent when a tool wakes.
- If there is not enough unspent power, that tool does not wake/fire.
- Tools that wake become used/spent for the current attempt.
- Used tools do not refund power if deleted later in the attempt.

### Stopped With Power

- Triggered when the tuber naturally slows to rest and unspent power remains.
- Tuber stays at its stopped position.
- Player gets a new setup phase.
- Player can use remaining power to continue, often by adding a small Bomb nudge or adjusting an unused tool.

### Failed / No Power

- Triggered when the tuber naturally stops and no power remains.
- Reset the attempt, not the level design.
- Tuber returns to the original start.
- Power is restored.
- Placed tools return to their pre-attempt positions/aims.
- Tool used/dormant state resets.
- The map is not cleared.

### Won

- Triggered when the tuber reaches the goal.
- In the prototype/editor, this can show success and allow next seed/level.
- In final game, this becomes the polished completion state.

## Power Economy

Power is an energy budget for tool use, not a placement budget.

- Placing tools is free.
- Deleting unused tools is free.
- Aiming tools is free during setup.
- Power is spent only when a tool wakes during a run.
- Used/spent tools do not refund power when deleted.
- Power resets only when the attempt resets or a new level begins.
- Levels should define total available power. Current prototype numbers can increase beyond the old 12-point placement budget.

Recommended UI language:

- `Power remaining`
- `Power spent`
- `Projected power` for Flow Ghost estimates

Avoid language that implies placement cost.

## Tools

### Jet

Purpose: basic directional force.

- Mounted on wall/water edges.
- Direction points from wall into adjacent water.
- Power levels 1-4.
- Straight Jet cost equals power level when it wakes.
- Angled Jet costs `power level + 2` when it wakes.
- Power 4 straight should feel close to the old full-power straight jet.
- Dormant until the tuber enters its aimed line-of-sight corridor.
- Once active, fires and decays until retired.

Line of sight:

- Uses the aimed stream corridor.
- Requires clear water between Jet and tuber.
- Should be readable in the editor.

### Bomb

Purpose: close nudge/course correction.

- Placed directly on water cells.
- Does not need a wall mount.
- Cost is `3 * power level` when it wakes.
- Power levels 1-4.
- Wakes when the tuber enters its visible ripple radius.
- Applies a radial nudge away from its water-cell center.
- Power changes ripple count and nudge strength.
- Current force scale target: `2.2 / 3.6 / 4.8 / 5.8`.
- Bombs should be useful for moving the tuber one or a few spaces into a later line-of-sight chain, not for replacing Jets.

### Bouncer

Purpose: deliberate high-impact launch/rebound tool.

- Mounted on wall/water edges.
- Flat cost: 8 power when it wakes.
- Sends the tuber strongly along its aimed direction.
- The only tool allowed to feel exaggerated.
- Should not make normal wall bounce feel like pinball.

## Tool States

Each placed tool should track:

- placed position
- aim/direction
- power level/type
- dormant or active
- used/spent state
- remaining force/decay state

Canonical behavior:

- Dormant tools do not apply force or decay.
- Waking a tool spends power and marks it used.
- Active tools apply force and decay.
- Retired tools no longer apply force.
- Used tools are part of the attempt history and do not refund power.

## Flow Controls

The flow control should not be pause/resume.

Preferred controls:

- Before run: `Start flow`
- During run: `Reset run`
- After natural stop with power remaining: `Start flow`
- After failed/no power: automatically reset attempt or show `Reset run`

Stopping an active run means the current attempt is abandoned and reset to setup state. It should not freeze the tuber in place.

## Flow Ghost

Flow Ghost is a fuzzy setup preview.

- Appears only while not actively running.
- Predicts likely tuber path and approximate resting point.
- Uses the same simulation rules as real play in the clean architecture.
- Should feel like an estimate, not a guarantee.
- Should show a faint dotted/fading path and a translucent final tuber echo.
- May show a few soft alternate echoes or wobble to communicate uncertainty.
- Should help players understand tool chains without turning the game into exact math.

Flow Ghost should estimate:

- triggered Jet/Bouncer chains
- Bomb nudges
- wall rebounds
- natural stopping point
- projected power use

## Tuber Movement And Bounce

The tuber should feel like a soft object in water, not billiards or pinball.

Design feel:

- Walls redirect the tuber away from danger.
- Direct hits bounce but lose energy.
- Glancing hits skim/slide, preserving forward motion.
- Corners should be forgiving.
- Normal wall bounce should not be the main puzzle mechanic.
- Bouncer is the exception that can create a dramatic rebound.

Target collision model:

- Use sampled collision normal around the tuber.
- Estimate wall normal from blocked samples.
- Split velocity into normal and tangent components.
- Reverse/dampen normal velocity.
- Preserve most tangent velocity.
- Nudge tuber gently out of the wall.

Suggested feel values for a future clean simulation:

- normal rebound: medium
- tangent carry: high
- water drag: steady
- corner correction: forgiving
- Bouncer override: stronger normal rebound and higher tangent carry

Avoid pure angle-perfect reflection. The game should reward planning and sequencing more than bank-shot precision.

## Level Modifiers

Later levels can vary fluid/tuber feel without changing core rules.

Potential modifiers:

- `fluidDensity`: changes drag and drift length.
- `wallBounce`: changes normal rebound.
- `tuberMass`: changes acceleration and inertia.
- `localDragZones`: sticky/viscous water patches.
- `currentZones`: passive directional water movement.

Progression examples:

- Early: normal fluid, forgiving bounce.
- Mid: denser fluid, shorter drift, more deliberate nudges.
- Late: mixed zones, line-of-sight chains, staged power use.

## Progression And Collectibles

Aquerra can support a light metroidvania structure without changing the core puzzle rules.

Progression gates should come from capabilities the player understands through the puzzle system:

- stronger Jet power levels
- a larger power cell / total power capacity
- new tool families such as Bombs or Bouncers
- optional level modifiers that require different routing ideas

Map regions can be visible but unreachable until the player has enough force, enough total power, or the right tool behavior to cross a basin, trigger a chain, or make a staged route work.

Collectibles:

- `jetUpgrade`: unlocks or improves maximum Jet power.
- `powerCellUpgrade`: increases total carried power for each attempt.
- `energyCell`: restores or adds usable power within a long level.
- `toolUnlock`: introduces Bombs, Bouncers, or future tool families.

Energy Cells should make longer levels possible without making placement free-play meaningless:

- They are collected by routing the tuber through them.
- They add power to the current attempt or refill a limited amount of power.
- They should be authored as part of the route, not sprinkled randomly.
- Flow Ghost should account for projected Energy Cell pickups once the rules are stable.

Design guardrail: upgrades should open new routes and puzzle chains, not just make old puzzles trivial. Earlier maps can include obvious unreachable areas so players remember to return later.

## Visual Direction

The prototype/editor should use crisp readable vector/SVG-style art. Final game can later translate these rules to 3D/isometric.

Use SVG or SVG-like vector assets for:

- water tiles
- wall tiles
- Jet/Bouncer bodies
- Bomb icons/ripples
- tuber
- goal
- tool stock icons
- power meters
- active/dormant states
- line-of-sight overlays

Editor visuals should answer:

- What is water?
- What is wall?
- Which way does this tool face?
- Is it dormant, active, used, or retired?
- What power level is it?
- What can see the tuber?
- Where does Flow Ghost expect the tuber to go?

Implementation note: avoid many DOM SVG elements per tile. Prefer loading SVGs as Phaser textures, drawing vector-like shapes in Phaser, or integrating assets properly during the clean rebuild.

## Level Data

The editor should eventually export a level format that the final game can consume.

Level data should include:

- basin/water mask
- start position
- goal position
- available power
- placed tools
- tool type, power level, direction/aim
- fluid/tuber modifiers
- optional authored zones
- metadata such as seed, name, difficulty, and notes

## Architecture Direction

The current prototype can continue as a design lab, but the cleaner rebuild should separate:

- `GameState` — basin, tuber, tools, goal, power budget, phase, attempt snapshot.
- `ToolRules` — Jet/Bomb/Bouncer activation, cost, force, decay.
- `Simulation` — deterministic movement, collision, line of sight, power spending, win/fail checks; no Phaser dependency.
- `Prediction` — Flow Ghost using the same simulation model as real play.
- `Renderer` — Phaser/canvas/SVG drawing only, derived from state.
- `InputController` — maps clicks/taps to game actions.
- `LevelGenerator` — procedural basin generation separate from mechanics.
- `Persistence` — import/export level JSON.

Primary rebuild goal: make real gameplay and Flow Ghost share one deterministic simulation engine.

## Current Prototype Debt

The prototype has been useful for learning quickly, but it now contains real debt:

- Most systems live in `src/main.ts`.
- Tool families share old Jet abstractions.
- Power economy in the current implementation may still behave like placement cost in places.
- Flow Ghost prediction duplicates parts of live simulation.
- Collision is still axis-split and should eventually become normal-based.

This is acceptable for exploration, but not ideal for the final editor foundation.

## Non-Goals

- Do not turn Aquerra into billiards or pinball.
- Do not make Flow Ghost an exact solver.
- Do not punish players for setup experimentation.
- Do not clear the level design when an attempt fails.
- Do not make Bombs replace Jets as the primary movement tool.
- Do not deeply wire final art systems into the current messy prototype unless the rebuild is delayed.

## Open Decisions

- Exact total power budget per early/mid/late level.
- Whether insufficient power prevents a tool from waking or allows a weak partial activation. Current recommendation: prevent activation.
- Whether used tools remain visible as spent markers during mid-run setup.
- How much Flow Ghost should reveal about trigger order.
- Whether level creator should allow manual authored levels before or after improving the procedural generator.
