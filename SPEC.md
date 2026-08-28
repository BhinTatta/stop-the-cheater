# "Stop the Cheater" — Build Spec

## Concept
A browser-based (mobile-first, desktop-compatible) puzzle game based on the classic "Jealous Partners" river-crossing puzzle, skinned as a Crossy-Road-style low-poly voxel game. Three couples (Red, Green, Blue) must all cross a river by boat. No signup, no accounts. Built for virality — this will be driven by Instagram Reels/ads, so fast load and a satisfying, screen-recordable loop matter as much as correctness.

## Tech stack
- Three.js (vanilla + TypeScript, no React wrapper)
- Vite for bundling/dev
- Deploy target: static hosting (Vercel/Netlify)
- Leaderboard: small serverless function + Postgres (name, time_seconds, created_at), fully decoupled from the game loop — the game must be 100% playable with the backend offline

## Entities
- 3 couples, color-coded: Red, Green, Blue — each couple is one man + one woman, no royal framing, just "Man (Red)" / "Woman (Red)" etc.
- Two banks: Left (start, all 6 present) and Right (goal)
- One boat, capacity 2, starts on the Left bank

## Rule engine (build FIRST, headless, before any rendering — this is the hard part)
State = { left: Set<Person>, right: Set<Person>, boat: Set<Person>, boatSide: 'left'|'right' }

**Valid moves:** boat carries 1 or 2 people per trip (never 0 — can't cross empty).

**Violation / loss condition:**
After every boat departure AND every arrival, check both banks independently:
> A bank is in violation if it has at least one woman whose partner is NOT present on that bank, AND at least one man is present on that bank (any man — even one who's there with his own partner; he still reacts).

Check the *departure* bank the instant the boat pushes off (don't wait for arrival) so a stranding move is caught immediately, not after the crossing animation finishes.

**Win condition:** all 6 people on the Right bank.

**Sanity check for your own testing** (don't hardcode this, just use it to validate the engine): the naive strategy of always ferrying 2 across and 1 back stalls — a correct solution needs at least one trip where 2 people return together. Verify a known valid 11-move solution passes your engine start-to-finish, plus test cases for: a safe move, a departure-bank violation, an arrival-bank violation.

Write as pure functions (`applyMove()`, `checkViolation()`, `isWin()`) with unit tests. No Three.js until these pass.

## Violation animation & game-over flow
- On violation: freeze input immediately
- The nearby man/men walk over to the unattended woman; play a short, comedic "kiss" animation (stylized/cartoonish, not graphic) with a synced kissing/smooch sound effect
- Hold on the animation for 2–3 seconds
- Then show a simple "Game Over" overlay with one button: **Retry**
- Retry resets engine state instantly, no reload, no fade-heavy transition — get the player back into a new attempt fast, since retry speed is a big driver of replayability/virality

## Boat movement — recommended interaction (mobile-first)
**Tap-to-select, not drag.** Tap a person on the bank to select them (highlight/outline + small hop animation to acknowledge the tap), tap them again to deselect, tap an empty boat seat to load a selected person aboard. This avoids the touch-drag flakiness (accidental drags, drag-vs-page-scroll conflicts) that punishes exactly the one-thumb, ad-click mobile player you're targeting — it's simpler to build and more forgiving to play than a drag gesture.

Rowing itself stays a separate, deliberate action: a large paddle/oar-shaped button that activates once 1–2 people are aboard. Don't auto-depart the boat — let the player explicitly choose to row with 1 or 2 aboard, which preserves the puzzle's strategic core (sometimes you *want* to send just one person) and gives you a clean, juicy "row" moment to animate: paddle strokes, water splash particles, a little screen-shake or camera-follow as the boat crosses.

Sequence: tap person (select) → tap boat seat (load, person hops in) → repeat for a second person if desired → row button activates and pulses → tap it → boat animates across with juicy feedback → arrival triggers the violation check → either safe (continue) or kiss animation → game over.

## Virality/shareability layer
- Keep the whole interaction loop under ~15–20 seconds per attempt so failed runs feel snackable, not punishing — this is what makes people replay on camera for a Reel
- End-of-run screen (win or loss) should be highly shareable: bold color-coded recap, final time, a "Retry" and a lightweight native share action if the platform supports it
- Juicy, exaggerated feedback everywhere: squash/stretch on characters, a slide-whistle or comedic sting on game over, confetti + a little fanfare on win
- Keep total initial payload small (instanced/low-poly geometry over textured models) so it loads fast from a cold ad click — a slow load is the #1 killer of ad-driven virality
- Add basic ad-attribution support (a simple UTM/query-param passthrough into your analytics) so you can see which creative is driving plays

## Mobile considerations
- Pointer events (not separate mouse/touch handlers) so tap-to-select works identically on both
- Test canvas resize on orientation change explicitly, don't leave it for last
- Isometric camera, fixed framing that keeps both banks + boat visible on a portrait phone screen without the player needing to pan/zoom

## Visual style direction — Phase 4 revision

**Lighting — establish one clear directional sun, not even ambient brightness.**
Set up a single strong directional light from a consistent classic angle (upper-left or upper-right, roughly 45°), warm-white in color, as the dominant light source. Ambient/fill light should be kept low relative to it, so there's real contrast: sunlit faces look bright, warm, and vivid, shadow faces are a clearly darker tint of the same hue (not near-black, not just a different ambient shade). Every object in the scene should show light and shadow faces consistent with this one light direction. The goal is that the scene reads as "direct sunlight hitting a bright day," which is currently missing — right now brightness varies across surfaces without a coherent source direction.

**Camera / framing — fill the entire viewport, don't float the scene in empty space.**
The current look-dev camera shows the play area as a small tile floating in a large empty sky void. Adjust the camera distance/angle/FOV so the ground and water extend to all edges of the screen with no visible empty void — the world should feel like it continues past the frame in every direction, matching the tightly-cropped, diagonal isometric framing in the reference image. This is the actual in-game camera behavior to build toward, not just a look-dev tweak.

**Boat — needs a real hull shape, not a flat colored block.**
Rebuild the boat as a proper small voxel hull: tapered/pointed bow, flat stern, slightly raised side walls, built from small blocks rather than one flat rectangular slab. Warm wood-brown base with a trim-color accent stripe, similar spirit to the reference's vehicle/prop construction (many small blocks reading as one recognizable shape).

**Trees — add more, and cluster them like the reference.**
Scatter several more trees around the edges of the play area (not just one or two), with the same stacked-cube-trunk-and-foliage construction already established, varying size slightly for visual interest. Reference the tree density and placement pattern in the attached Crossy Road image.

## Visual style & interaction — Phase 5 revision

**Female silhouette.** Women get a flared two-tone skirt (a stepped hip block + a wider hem block, plus a trim-color hem stripe) instead of separate leg blocks, so gender reads from silhouette alone, not just color.

**Trees only on the far bank.** The camera is fixed, and any tree on the near bank sits between the camera and the whole play area. Trees stay on the far bank only; the near bank gets low bushes instead, which never block the view.

**World scale.** The bank grid extends far past the camera frame in every direction (not just the playable strip), and the camera pulled back slightly — no visible edge where ground meets sky, and characters read as standing in a real landscape rather than on a floating tile.

**Boat — two seats, real shape.** Rebuilt with a proper tapered hull (flat stern to a rounded bow across six stepped segments), raised gunwale walls, a trim stripe, and two distinct bench seats matching the boat's 2-person capacity.

**Blocky shadows, grounded idle.** Contact shadows are flat rectangles sized to each object's footprint, not soft circular blobs. Idle characters no longer bob vertically — feet stay planted; personality instead comes from a slow idle head-turn and a subtle arm sway, both driven from real shoulder/neck pivot joints on the character rig.

**Boarding interaction (first pass).** Tapping an idle character on the boat's current bank walks them to an open seat (with a stride cycle — leg/arm swing, a small step bob, a slight waddle sway) and seats them; tapping a seated character (boat still docked) walks them back off. A row button — styled consistent with the rest of the HUD, pulses when at least one seat is occupied — animates the boat crossing; on arrival, seated characters disembark with the same walk cycle. This is a visual/interaction prototype only, not yet wired to the real rule engine from Phase 1 — that wiring happens when this moves into the actual Vite/Three.js app.

## Visual style & interaction — Phase 6 revision

**Start on the near bank.** All 6 characters — and the boat's initial dock — now start on the bank closest to the fixed camera, so faces are visible from the first frame. Trees stay on the far bank (unchanged); the near bank keeps its low bushes.

**Boat docking, no clipping.** The dock positions are computed from the boat's own half-length against the water plane's edge, so the hull's outer edge touches the bank exactly instead of overlapping into the bank tiles.

**Characters face the camera.** Idle and seated characters hold a fixed facing toward the camera (computed once from the camera's angle) instead of retaining whatever direction their last walk left them pointed — no more characters standing sideways.

**Larger world, smaller characters.** Character scale and the camera's zoom were both pulled back further, and bank-slot spacing widened, so couples read as separated individuals rather than a congested cluster.

**Fixed home slots.** Each character now has a permanent home index (0-5, mirrored per bank) instead of claiming whichever bank slot happens to be free. A character always returns to the same numbered spot on whichever bank they're standing on, so couples don't visually "shuffle" across multiple crossings.

## Camera & lighting — locked (Phase 7)

The user confirmed the camera angle via a screenshot of the app itself, so this is now the reference framing to build the real game camera against — not a look-dev placeholder.

**Camera.** Fixed orthographic, looking mostly along the world's X axis (the crossing direction) from the near/right bank's side — not the 45°-corner isometric view earlier passes used. Zoomed tight enough that the ground fills the frame edge-to-edge on a portrait phone with no sky boundary visible at top or bottom; the bank grid itself extends ~11-12 world units past the visible play area in every direction as a buffer so tightening the crop further never reveals an edge.

**Lighting bug (fixed).** The key light had been positioned on the opposite side from the camera — a leftover from an earlier camera-angle revision that was never re-checked after the camera's azimuth changed. Since characters are rotated to face the camera, this meant their backs were lit and their visible (camera-facing) side sat in shadow. The key light now sits on the same side as the camera; fill stays on the opposite side.

**Couple layout — triangle, not a line.** The three couples stand at the corners of a triangle rather than in a single row: one couple near the water (closest to the boat), the other two spread wide at the back corners. Far-bank tree placement was thinned near where the back-corner couples land after crossing, so there's real room once they arrive.

## Camera & framing — corrections (Phase 8)

**Camera side.** The initial camera azimuth approached from the wrong side; flipped to approach from the right, per direction. The key/fill lights and the character "face the camera" calculation are all derived from the camera's position, so they followed the flip automatically — nothing needed a separate fix.

**Off-screen couples at default zoom (real bug).** After locking the tighter framing in Phase 7, the triangle layout's back-corner couples (spread to z = ±2.6) exceeded the visible horizontal frustum at the zoom level needed to hide the ground boundary — on some phone aspect ratios one whole couple could render entirely off-screen until the player zoomed out manually. Root-caused by projecting each character's screen-space bounds directly (not by eyeballing screenshots) across several real phone aspect ratios (390×844, 412×915, 375×812). Fixed by narrowing the triangle's spread (back corners now at z = ±0.85/±1.35) and shifting the camera's look-at target off the world's Z origin to recenter the framing — the two back corners don't sit symmetrically on screen around world Z=0 given this camera's azimuth, so centering the target on the content (not the origin) was required, not just a bigger frustum. Verified with margin on all three tested aspect ratios.

## Engine wiring (Phase 9) — real game, not a prototype

The look-dev artifact's visual language (palette, geometry builders, camera, lighting, character rig, boat, banks) is now ported into the actual Vite/TypeScript app under `src/scene/` and `src/ui/`, driven by the real rule engine from Phase 1 (`src/engine/`) via a new orchestrator, `src/game/Game.ts` — not the artifact's free-roam local state machine. `src/scene.ts` (the Phase 0 placeholder) is gone.

**Bank-side mapping.** The engine always starts everyone in its own `left` bank; the art direction wants play to start on the bank nearest the camera (world-space positive X). These are different axes — `src/scene/layout.ts` defines `WorldSide` independently of the engine's `BankSide`, and `Game.ts` is the one place that translates between them (engine `'left'` → world `'right'`, i.e. the near/starting bank).

**Boarding/rowing.** Tapping an idle character on the boat's current (engine-side-translated) bank calls the engine's real `board()`; tapping a seated character calls `unboard()`. Both mutate `Game`'s `engineState` immediately — the walk animation is purely visual and follows from that state change, not the other way around. The Row button calls the engine's real `row()` and gets back a `RowOutcome` used to drive everything downstream. (See Phase 10 for how departure violations are now handled — this paragraph originally described an instant, unanimated departure-violation path that has since been replaced.)

**Violation → kiss → game over.** On a violation, `Game.ts` reads the actual violated bank `Set<PersonId>` from the engine's own outcome (not a re-derived guess) to find every man present and the unattended woman, exactly matching `checkViolation`'s rule. The reacting men walk to her with the same stride-cycle animation used for boarding; once all have arrived, a heart sprite pops in with a synced "smooch" sound cue, holds ~2.2s, then the "Couldn't Stop the Cheater!" game-over panel fades in with a Retry button that resets both the engine state (`createInitialState()`) and every character's visual position/rotation in one call.

**Win screen.** Deliberately left as an undesigned placeholder (reuses the game-over panel's visual language with different copy) — real design is a follow-up, but it isn't a dead end: Retry works from it too.

Verified end-to-end against a known violation scenario (driven directly through the engine, not guessed): board a single person alone, confirm the departure violation fires with the exact expected unattended woman and reacting men, confirm the kiss sequence and game-over panel appear, confirm Retry fully resets engine and visual state. `tsc --noEmit`, the 12 engine unit tests, and `vite build` all pass clean.

## Row-animation-first & a real freeze bug (Phase 10)

Two related problems, both in `src/game/Game.ts`, found via manual play: crossing a specific multi-trip sequence (send two women over, one returns alone, then she re-boards paired with a man from a different couple) froze the game — no popup, no boat movement, nothing — and separately, the departure-violation path skipped the rowing animation entirely and jumped straight to the kiss sequence, which read as broken even when it wasn't.

**Behavior change: always animate the row, check violations after.** `onRowClicked()` no longer special-cases `outcome.violatedAt === "departure"` to skip the crossing animation. Every row now plays the full boat-crossing animation (`gamePhase = "crossing"`, `boatMoving = true`) regardless of outcome; `finishCrossing()` is the single place that inspects the `RowOutcome` afterward and decides what happens next — normal disembark, win, or `beginKissSequence()` for a violation on whichever bank (`departureViolation` or `arrivalViolation`) actually triggered it. Because the engine voids a departure-violated trip (`row()` returns the *unchanged* pre-move state — the boat never really leaves, `boatSide` doesn't update), the crossing direction can no longer be read back out of `engineState.boatSide` after the fact for animation purposes; `onRowClicked()` now captures `crossFromWorld`/`crossToWorld` explicitly before calling `row()`, and `animate()`'s boat-position interpolation uses those instead. On a departure violation, the boat is deliberately left parked at the far dock where the animation carried it (with the two rowers still visibly seated in it) rather than snapped back to match the engine's unmoved `boatSide` — visually, the couple that left is stranded on the far bank while the kiss confrontation plays out on the bank they abandoned, which reads correctly rather than as a continuity error.

**The actual freeze bug.** While making that change, `finishCrossing()`'s per-seat cleanup loop unconditionally reset `entry.seatIndex = -1` for both boat occupants before checking whether they should stay seated. For a violated trip (where passengers are deliberately left seated rather than walked to a bank), that left `entry.state === "seated"` but `entry.seatIndex === -1` — and `updateCharacter()`'s "seated" branch indexes `BOAT_LOCAL_SEATS[entry.seatIndex]` unconditionally, so the very next animation frame threw `TypeError: Cannot read properties of undefined (reading 'x')`. That exception fired inside `Game.animate()`, before the frame's `renderer.render()` call — so the scene silently stopped repainting every subsequent frame while `requestAnimationFrame` kept quietly re-triggering the same throw. No console-visible crash from the user's perspective, no popup, no boat movement: exactly the reported freeze. Fix: only reset `entry.seatIndex` (and only then start the walk-to-bank animation) when the trip wasn't violated; a still-seated passenger now keeps a valid seat index so their boat-relative position stays computable every frame.

Verified via Playwright driving the exact reported repro sequence (send red-woman + green-woman across, green-woman returns alone, board green-woman + blue-man, row) — confirmed it previously threw under the row-animation-first change without the seat-index fix, and confirmed it now completes cleanly: crossing animation plays, boat parks at the far dock with the departing couple visible in it, the reacting men walk to the stranded woman, kiss, and game-over panel all fire correctly. Also re-verified, with no regressions: the known 11-move winning solution and the known arrival-bank-violation scenario from `rules.test.ts`, both end-to-end through the real UI, plus Retry resetting cleanly afterward. `tsc --noEmit`, all 12 engine unit tests, and `vite build` pass clean.

## Explicitly out of scope for v1
- Accounts, auth, social login
- In-game monetization/ads
- Level variants — this is a single fixed 3-couple puzzle

---

## Build phases

**Phase 0 — Repo setup**
Vite + TypeScript scaffold, Three.js installed, a responsive full-viewport canvas that resizes correctly on both desktop and mobile/orientation-change, basic deploy config for Vercel/Netlify, nothing rendered yet beyond a placeholder scene.

**Phase 1 — Game engine (headless)**
Implement and unit-test `applyMove()`, `checkViolation()`, `isWin()` exactly per the rules above, with no rendering involved. This is the phase to get bulletproof before moving on — a bug here means a "broken" puzzle no amount of polish will fix.

**Phase 2 — 3D scene & models**
Two bank platforms, a boat, and six characters as simple color-coded low-poly voxel figures (placeholder geometry is fine at first — capsules/blocks — polish shapes later). Isometric camera, basic lighting, static scene wired to reflect engine state (characters render on the correct bank/boat).

**Phase 3 — Core interaction**
Tap-to-select people, tap-to-load onto boat seats (pointer events), the row button (inactive/active states, pulse when ready), boat-crossing animation, timer starting on first move.

**Phase 4 — Violation & win flow**
Kiss animation + sound on violation, 2–3s hold, Game Over overlay with Retry (instant reset). Win detection, win screen, name entry, submit to leaderboard endpoint, display top-N times.

**Phase 5 — Mobile & performance polish**
Real-device testing on phone, orientation-change handling, asset size trims, frame-rate check on mid-range Android hardware (not just a high-end test device — your ad audience skews toward whatever phone they already have).

**Phase 6 — Virality layer**
Juicy feedback pass (squash/stretch, splash particles, screen-shake, comedic sound design), shareable end screen, fast cold-load optimization, basic ad-attribution passthrough.

**Phase 7 — Deploy**
Production build, static hosting, leaderboard backend deployed separately, smoke-test the full loop from a fresh mobile browser session before running any ad spend.
