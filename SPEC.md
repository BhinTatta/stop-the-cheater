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
