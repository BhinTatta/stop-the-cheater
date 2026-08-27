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

## Visual style direction — Phase 3 revision (v2 art-direction fixes)

**Voxel density — characters need far more detail, not just primitive blocks.**
Current characters are ~5 flat boxes and read as crude, not voxel-rich. Rebuild each character from many smaller voxel cubes: separate small cubes for eyes (white base + black pupil), a distinct color band at the collar/waist to break up the torso into two tones, small accent cubes for hair/hat detail, and clearly separated shoe-sole blocks in a contrasting dark color. Look at the reference characters' actual voxel count — they're assembled from dozens of small cubes, not a handful of large primitives.

**Water — make it flat and stylized, not a realistic gradient.**
Replace the current smooth navy gradient water with a flat, bright cyan/turquoise color (no gradient, no realistic depth shading). Add hard-edged white foam/wave shapes as flat geometric patterns on the surface, matching the crisp turquoise water blocks in the reference images — not a smooth realistic ocean look.

**Shadows — hard-edged, not soft/blurred.**
Turn off soft shadow blur entirely (disable PCF softening / shadow radius) so shadows read as crisp, hard-edged flat shapes under each character and object, matching the reference's sharp shadow blobs. If true shadow maps keep coming out soft, fake it instead with a simple flat dark decal shape under each character's feet.

**Shading contrast — shadow-side faces are currently too dark.**
Right now the darker cube faces are going close to black, losing all color information. Shadow-side faces should read as a darker tint of the same hue (e.g., darker green, not near-black), not a different near-black color. Raise ambient/fill light so no face drops much below roughly half the brightness of the lit face.

**Overall brightness — scene needs to be brighter and punchier.**
Increase global light intensity / exposure and boost saturation across the whole palette (grass, water, couple colors). The reference images read as bright and cheerful at a glance; the current pass reads muted and dim by comparison.

**Add environment props for charm.**
Scatter simple blocky trees (stacked cube trunk + cube foliage, like the reference tree), small bushes, and flowers around the play area at a scale clearly smaller than the characters — this is currently missing and the reference relies on these small touches for its charm.

**Palette — use a small, deliberately curated set of fully-saturated colors, not defaults.**
Define an explicit limited palette up front (roughly 6-8 named colors total) rather than letting materials default to whatever mid-tone values come out of the color picker: two bright grass-green shades for the checkerboard tiles, one saturated cyan-turquoise for water, one warm mid-brown for wood/boat, and fully-saturated (not pastel, not muddy) red/green/blue for the couples. Every color in the scene should be either one of these or a close variant — avoid any grayish, muddy, or desaturated tones creeping in anywhere except thin dirt/soil trim strips. This consistency (not just individual color brightness) is what makes the reference read as polished rather than default-generated.

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
