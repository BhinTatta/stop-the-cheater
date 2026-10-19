import * as THREE from "three";
import {
  ALL_PERSON_IDS,
  board,
  createInitialState,
  getPartnerId,
  getPerson,
  row,
  unboard,
  type BankSide,
  type GameState,
  type PersonId,
  type RowOutcome,
} from "../engine";
import { computeFrustumSize, createCamera, idleFacingY, resizeCamera, syncCameraPose } from "../scene/camera";
import {
  addLights,
  addSunGlow,
  buildWater,
  makeSkyTexture,
  scatterClouds,
  scatterFoam,
  updateClouds,
  WATER_LEN,
  type WaterHandle,
} from "../scene/environment";
import { buildBank, LEFT_BANK_SPEC, RIGHT_BANK_SPEC } from "../scene/bank";
import { disposeMerged } from "../scene/merge";
import { buildBoat, BOAT_FLOOR_H, BOAT_LOCAL_SEATS, DOCK_LEFT_X, DOCK_RIGHT_X } from "../scene/boat";
import { buildCharacter, type CharacterRig } from "../scene/character";
import { allHomeSlots, homeSlot, CHAR_HEIGHT_Y, type WorldSide } from "../scene/layout";
import { PALETTE } from "../scene/palette";
import { playBoop, playGameOverSting, playKiss, stopKiss, unlockAudio } from "../scene/audio";
import { createOverlay, type Overlay } from "../ui/overlay";
import { createTuningPanel, type TuningPanel } from "../ui/tuningPanel";
import { applyAspectPreset, onTuningChange, tuning, tuningEnabled, type TuningKey } from "../scene/tuning";
import { fetchStats, postEvent } from "../net/api";
import { generateShareImage } from "../share/shareImage";
import { buildChallengeUrl, challengeBannerText, parseChallengeFromUrl, resultSentence } from "../share/challenge";

type CharState = "idle" | "walkingToBoat" | "seated" | "walkingToBank" | "walkingToKiss" | "kissPose";

interface CharacterEntry {
  id: PersonId;
  rig: CharacterRig;
  state: CharState;
  seatIndex: number;
  walkFrom: THREE.Vector3;
  walkTo: THREE.Vector3;
  walkStart: number;
  walkDur: number;
  walkFacing: number;
}

type GamePhase = "intro" | "boarding" | "crossing" | "kissing" | "gameover" | "win";

interface KissSequence {
  men: PersonId[];
  woman: PersonId;
  phase: "walking" | "holding";
  holdStart: number;
}

const STRIDE_FREQ = 10;
const MIN_PIXEL_RATIO = 1;

// Rough character bounds (rig is ~1.08 tall at BASE_SCALE 0.85, ~0.48 wide),
// used only to measure how close they come to the edge of the frame.
const CHAR_TOP_Y = 0.95;
const CHAR_HALF_W = 0.22;

/**
 * The engine's abstract "left"/"right" banks are not the same axis as our
 * world-space "left"/"right" (which describe which side of X=0 something
 * sits on). The engine always starts everyone in state.left, and the art
 * direction wants play to start on the bank nearest the camera (world
 * "right", positive X) — so engine 'left' maps to world 'right' and vice
 * versa. This is the one place that mapping happens.
 */
function toWorldSide(engineSide: BankSide): WorldSide {
  return engineSide === "left" ? "right" : "left";
}

function dockXFor(worldSide: WorldSide): number {
  return worldSide === "right" ? DOCK_RIGHT_X : DOCK_LEFT_X;
}

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private canvas: HTMLCanvasElement;
  private clock = new THREE.Clock();
  private resizeObserver: ResizeObserver;
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();

  private engineState: GameState;
  private chars = new Map<PersonId, CharacterEntry>();
  private boat: THREE.Group;
  private boatSeatOccupant: (PersonId | null)[] = [null, null];
  private boatMoving = false;
  private boatCrossT = 0;
  private boatCrossStart = 0;
  private readonly boatCrossDur = 2.0;
  private crossFromWorld: WorldSide = "right";
  private crossToWorld: WorldSide = "left";
  private pendingOutcome: RowOutcome | null = null;

  private gamePhase: GamePhase = "boarding";
  private kissSeq: KissSequence | null = null;
  private heartSprite: THREE.Sprite | null = null;

  private moveCount = 0;
  private startTimeMs: number | null = null;
  private lastWinResult: { moves: number; timeSeconds: number } | null = null;
  private shareBlob: Blob | null = null;

  private water: WaterHandle;
  private clouds: ReturnType<typeof scatterClouds>;
  private overlay: Overlay;
  private banks: THREE.Group[] = [];
  private tuningPanel: TuningPanel | null = null;
  private tuningDirty = false;
  private banksDirty = false;
  private nextDiagnosticsAt = 0;

  private basePixelRatio = 1;
  private pixelRatio = 1;
  private perfSamples = 0;
  private slowFrames = 0;

  private downX = 0;
  private downY = 0;
  private downId = -1;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement("canvas");
    this.canvas.id = "game-canvas";
    container.appendChild(this.canvas);

    // MSAA on a 2x+ screen buys very little and costs real fill rate on a
    // mid-range phone, where the device pixel ratio is already doing the
    // smoothing. Desktop (1x) keeps it.
    const dpr = window.devicePixelRatio || 1;
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: dpr < 2,
      powerPreference: "high-performance",
    });
    this.basePixelRatio = Math.min(dpr, 2);
    this.pixelRatio = this.basePixelRatio;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    this.scene = new THREE.Scene();
    this.scene.background = makeSkyTexture();
    this.scene.fog = new THREE.Fog(0xbfe8fa, 26, 52);

    const aspect = container.clientWidth / Math.max(container.clientHeight, 1);
    applyAspectPreset(aspect);
    this.camera = createCamera(aspect);

    addLights(this.scene);
    addSunGlow(this.scene);
    this.clouds = scatterClouds(this.scene);

    this.banks = [buildBank(LEFT_BANK_SPEC), buildBank(RIGHT_BANK_SPEC)];
    this.banks.forEach((bank) => this.scene.add(bank));

    this.water = buildWater();
    this.scene.add(this.water.mesh);
    this.syncWaterToBankDepth();
    scatterFoam(this.scene);

    this.boat = buildBoat();
    this.scene.add(this.boat);

    this.engineState = createInitialState();
    ALL_PERSON_IDS.forEach((id) => {
      const person = getPerson(id);
      const bodyColor = PALETTE[person.color];
      const rig = buildCharacter(bodyColor, person.gender === "woman");
      rig.root.userData.personId = id;
      this.scene.add(rig.root);
      this.chars.set(id, {
        id,
        rig,
        state: "idle",
        seatIndex: -1,
        walkFrom: new THREE.Vector3(),
        walkTo: new THREE.Vector3(),
        walkStart: 0,
        walkDur: 0.75,
        walkFacing: idleFacingY(),
      });
    });
    this.placeAllAtHome();
    this.dockBoat();

    this.overlay = createOverlay(container);
    this.overlay.rowButton.addEventListener("click", () => this.onRowClicked());
    this.overlay.retryButton.addEventListener("click", () => this.retry());
    this.overlay.resetButton.addEventListener("click", () => this.retry());
    this.updateRowButton();
    this.setupGrowthAndSharing();

    // Applying on the next frame rather than inside the listener keeps a
    // slider drag — or a resize re-blending the preset — to one scene
    // update per rendered frame. Registered even without the harness,
    // since a resize changes the tuned values on its own.
    onTuningChange((key: TuningKey) => {
      this.tuningDirty = true;
      if (key === "bankHalfDepth") this.banksDirty = true;
    });
    if (tuningEnabled()) this.tuningPanel = createTuningPanel(container);

    this.canvas.addEventListener("pointerdown", (e) => {
      unlockAudio();
      this.downX = e.clientX;
      this.downY = e.clientY;
      this.downId = e.pointerId;
    });
    this.canvas.addEventListener("pointerup", (e) => {
      if (e.pointerId !== this.downId) return;
      const dx = e.clientX - this.downX;
      const dy = e.clientY - this.downY;
      if (Math.abs(dx) + Math.abs(dy) < 6) this.handleTap(e);
    });

    // A backgrounded tab or a GPU reset takes the context away; three can
    // restore itself, but only if the default "give up" is prevented and
    // the loop is parked until the context is back.
    this.canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.renderer.setAnimationLoop(null);
    });
    this.canvas.addEventListener("webglcontextrestored", () => {
      this.renderer.setAnimationLoop(() => this.animate());
    });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    this.renderer.setAnimationLoop(() => this.animate());
  }

  // ---------- setup / reset helpers ----------

  private placeAllAtHome(): void {
    const startWorldSide = toWorldSide(this.engineState.boatSide);
    this.chars.forEach((entry) => this.resetCharacterVisual(entry, startWorldSide));
  }

  private resetCharacterVisual(entry: CharacterEntry, worldSide: WorldSide): void {
    const slot = homeSlot(entry.id, worldSide);
    entry.rig.root.position.set(slot.x, CHAR_HEIGHT_Y, slot.z);
    entry.rig.root.rotation.set(0, idleFacingY(), 0);
    entry.rig.root.scale.setScalar(entry.rig.baseScale);
    entry.state = "idle";
    entry.seatIndex = -1;
    for (const g of [entry.rig.head, entry.rig.armL, entry.rig.armR, entry.rig.legL, entry.rig.legR]) {
      g?.rotation.set(0, 0, 0);
    }
  }

  private dockBoat(): void {
    const worldSide = toWorldSide(this.engineState.boatSide);
    this.boat.position.set(dockXFor(worldSide), 0.05, 0);
    this.boat.rotation.set(0, 0, 0);
  }

  // ---------- interaction ----------

  private handleTap(e: PointerEvent): void {
    if (this.gamePhase !== "boarding") return;
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const roots = Array.from(this.chars.values()).map((c) => c.rig.root);
    const hits = this.raycaster.intersectObjects(roots, true);
    if (!hits.length) return;
    let obj: THREE.Object3D | null = hits[0].object;
    while (obj && !obj.userData.personId) obj = obj.parent;
    const id = obj?.userData.personId as PersonId | undefined;
    if (!id) return;

    const entry = this.chars.get(id)!;
    if (entry.state === "idle" && this.engineState[this.engineState.boatSide].has(id) && this.engineState.boat.size < 2) {
      this.boardCharacter(id);
    } else if (entry.state === "seated") {
      this.unboardCharacter(id);
    }
  }

  private startWalk(entry: CharacterEntry, target: THREE.Vector3, duration: number): void {
    entry.walkFrom.copy(entry.rig.root.position);
    entry.walkTo.copy(target);
    entry.walkStart = this.clock.elapsedTime;
    entry.walkDur = duration;
    const dx = target.x - entry.rig.root.position.x;
    const dz = target.z - entry.rig.root.position.z;
    if (Math.abs(dx) + Math.abs(dz) > 0.001) {
      entry.walkFacing = Math.atan2(dx, dz);
    }
  }

  private seatWorldPosition(seatIndex: number): THREE.Vector3 {
    const seat = BOAT_LOCAL_SEATS[seatIndex];
    return new THREE.Vector3(this.boat.position.x + seat.x, this.boat.position.y + BOAT_FLOOR_H, this.boat.position.z + seat.z);
  }

  private boardCharacter(id: PersonId): void {
    const entry = this.chars.get(id)!;
    const seatIdx = this.boatSeatOccupant[0] ? (this.boatSeatOccupant[1] ? -1 : 1) : 0;
    if (seatIdx === -1) return;

    this.ensureTimerStarted();
    this.engineState = board(this.engineState, id);
    this.boatSeatOccupant[seatIdx] = id;
    entry.seatIndex = seatIdx;
    entry.state = "walkingToBoat";
    this.startWalk(entry, this.seatWorldPosition(seatIdx), 0.75);
    playBoop();
    this.updateRowButton();
  }

  private unboardCharacter(id: PersonId): void {
    const entry = this.chars.get(id)!;
    this.engineState = unboard(this.engineState, id);
    this.boatSeatOccupant[entry.seatIndex] = null;
    entry.seatIndex = -1;
    const worldSide = toWorldSide(this.engineState.boatSide);
    const slot = homeSlot(id, worldSide);
    entry.state = "walkingToBank";
    this.startWalk(entry, new THREE.Vector3(slot.x, CHAR_HEIGHT_Y, slot.z), 0.75);
    playBoop();
    this.updateRowButton();
  }

  private onRowClicked(): void {
    if (this.gamePhase !== "boarding" || this.engineState.boat.size === 0) return;

    // Capture the crossing direction before rowing: on a departure
    // violation the engine voids the trip and leaves boatSide unchanged,
    // so we can't derive "where the boat is headed" from engineState
    // after the fact. The rowing animation always plays in full — the
    // kiss check only happens once it's done, on whichever bank(s) it
    // turns out to apply to.
    const originWorldSide = toWorldSide(this.engineState.boatSide);
    this.crossFromWorld = originWorldSide;
    this.crossToWorld = originWorldSide === "left" ? "right" : "left";

    const outcome = row(this.engineState);
    this.engineState = outcome.state;

    this.gamePhase = "crossing";
    this.boatMoving = true;
    this.boatCrossT = 0;
    this.boatCrossStart = this.clock.elapsedTime;
    this.pendingOutcome = outcome;
    this.updateRowButton();
  }

  private finishCrossing(): void {
    this.boatMoving = false;
    const outcome = this.pendingOutcome!;
    this.pendingOutcome = null;

    if (outcome.violatedAt === "departure") {
      // The engine voided this trip — boatSide never changed — but we
      // still animated the row for visual continuity, so leave the boat
      // parked at the far dock the animation carried it to rather than
      // snapping it back to where engineState says it "really" is.
      this.boat.position.set(dockXFor(this.crossToWorld), 0.05, 0);
      this.boat.rotation.set(0, 0, 0);
    } else {
      // A departure violation voids the trip, so only a trip that actually
      // happened counts as a move.
      this.moveCount++;
      this.dockBoat();
    }

    for (let seatIdx = 0; seatIdx < 2; seatIdx++) {
      const id = this.boatSeatOccupant[seatIdx];
      if (!id) continue;
      this.boatSeatOccupant[seatIdx] = null;
      if (!outcome.violated) {
        const entry = this.chars.get(id)!;
        entry.seatIndex = -1;
        const slot = homeSlot(id, this.crossToWorld);
        entry.state = "walkingToBank";
        this.startWalk(entry, new THREE.Vector3(slot.x, CHAR_HEIGHT_Y, slot.z), 0.8);
      }
      // If violated, leave them seated (their entry.seatIndex stays valid so
      // updateCharacter can keep positioning them on the boat) — beginKissSequence()
      // below redirects the reacting men and leaves everyone else, including
      // these two, to resolve visually in place.
    }

    if (outcome.violatedAt) {
      const violation = outcome.violatedAt === "departure" ? outcome.departureViolation : outcome.arrivalViolation!;
      const engineSide: BankSide = violation.left ? "left" : "right";
      this.beginKissSequence(engineSide);
    } else if (outcome.win) {
      this.gamePhase = "win";
      const timeSeconds = this.startTimeMs !== null ? (performance.now() - this.startTimeMs) / 1000 : 0;
      this.lastWinResult = { moves: this.moveCount, timeSeconds };
      postEvent("complete", timeSeconds);
      this.overlay.showWin(this.lastWinResult);
      this.pregenerateShareImage("");
    } else {
      this.gamePhase = "boarding";
    }
    this.updateRowButton();
  }

  private beginKissSequence(engineSide: BankSide): void {
    const bank = this.engineState[engineSide];
    const men = [...bank].filter((id) => getPerson(id).gender === "man");
    const women = [...bank].filter((id) => getPerson(id).gender === "woman");
    const unattended = women.filter((id) => !bank.has(getPartnerId(id)));

    if (unattended.length === 0 || men.length === 0) {
      // Shouldn't happen given the engine already confirmed a violation,
      // but don't soft-lock the game on an unexpected state.
      this.gamePhase = "boarding";
      return;
    }

    const woman = unattended[0];
    this.gamePhase = "kissing";
    this.kissSeq = { men, woman, phase: "walking", holdStart: 0 };

    const womanEntry = this.chars.get(woman)!;
    const womanPos = womanEntry.rig.root.position;
    men.forEach((manId, i) => {
      const entry = this.chars.get(manId)!;
      const offset = (i - (men.length - 1) / 2) * 0.4;
      const target = new THREE.Vector3(womanPos.x, CHAR_HEIGHT_Y, womanPos.z + offset + (offset === 0 ? 0.4 : 0));
      entry.state = "walkingToKiss";
      this.startWalk(entry, target, 0.9);
    });
  }

  /**
   * One sprite, reused. Building a fresh canvas texture and material per
   * violation leaked both every time — the old sprite left the scene but
   * its GPU texture never did, so a long session climbed steadily.
   */
  private spawnHeart(position: THREE.Vector3): void {
    if (!this.heartSprite) {
      const material = new THREE.SpriteMaterial({ map: getHeartTexture(), transparent: true, depthWrite: false });
      this.heartSprite = new THREE.Sprite(material);
    }
    const sprite = this.heartSprite;
    (sprite.material as THREE.SpriteMaterial).opacity = 1;
    sprite.scale.set(0.001, 0.001, 1);
    sprite.position.set(position.x, position.y + 1.15, position.z);
    if (!sprite.parent) this.scene.add(sprite);
  }

  // ---------- retry ----------

  private retry(): void {
    stopKiss();
    this.engineState = createInitialState();
    this.boatSeatOccupant = [null, null];
    this.boatMoving = false;
    this.pendingOutcome = null;
    this.kissSeq = null;
    if (this.heartSprite) this.scene.remove(this.heartSprite);
    this.placeAllAtHome();
    this.dockBoat();
    this.gamePhase = "boarding";
    this.overlay.hideGameOver();
    this.overlay.hideWin();
    this.updateRowButton();

    // Only a puzzle that was actually under way counts as a fresh attempt
    // — resetting an untouched board would double-count the load.
    const wasUnderWay = this.startTimeMs !== null;
    this.moveCount = 0;
    this.startTimeMs = null;
    this.lastWinResult = null;
    this.shareBlob = null;
    if (wasUnderWay) postEvent("attempt");
  }

  private ensureTimerStarted(): void {
    if (this.startTimeMs === null) this.startTimeMs = performance.now();
  }

  // ---------- growth & sharing ----------

  private setupGrowthAndSharing(): void {
    postEvent("attempt");

    // Null when no stats store is configured (fetchStats filters that out),
    // in which case the badge simply never appears.
    fetchStats().then((stats) => {
      if (stats) this.overlay.setPlayCount(2000 + stats.plays);
    });

    this.overlay.onNameChange((name) => this.pregenerateShareImage(name));
    this.overlay.onShareClick(() => this.handleShareClick());
    this.overlay.onDownloadClick(() => this.handleDownloadClick());
    this.overlay.onCopyLinkClick(() => this.handleCopyLinkClick());

    const challenge = parseChallengeFromUrl();
    if (challenge) {
      this.gamePhase = "intro";
      this.overlay.showChallengeBanner(challengeBannerText(challenge), () => {
        this.gamePhase = "boarding";
      });
    }
  }

  private async pregenerateShareImage(name: string): Promise<void> {
    if (!this.lastWinResult) return;
    const blob = await generateShareImage({ name, moves: this.lastWinResult.moves, timeSeconds: this.lastWinResult.timeSeconds });
    this.shareBlob = blob;
  }

  /**
   * One button for every platform. On phones the native sheet carries the
   * card image itself, which is what Instagram Stories (and WhatsApp, iMessage
   * and friends) pick up; on a desktop browser with no share sheet it falls
   * back to copying the challenge link and saving the card so it can be
   * dropped into a story by hand.
   */
  private async handleShareClick(): Promise<void> {
    if (!this.lastWinResult) return;
    const name = this.overlay.getName();
    const url = buildChallengeUrl({ name, moves: this.lastWinResult.moves, timeSeconds: this.lastWinResult.timeSeconds });
    const text = resultSentence(name, this.lastWinResult.moves);
    const files = this.shareBlob ? [new File([this.shareBlob], "stop-the-cheater.png", { type: "image/png" })] : [];

    try {
      if (files.length && navigator.canShare?.({ files })) {
        await navigator.share({ files, text, url, title: "Stop the Cheater" });
        return;
      }
      if (navigator.share) {
        await navigator.share({ text, url, title: "Stop the Cheater" });
        return;
      }
    } catch (err) {
      // AbortError is the user closing the sheet — anything else means the
      // sheet failed, so fall through to the copy/save path below.
      if (err instanceof DOMException && err.name === "AbortError") return;
    }

    const copied = await this.copyToClipboard(url);
    this.handleDownloadClick();
    this.overlay.flashShareLabel(copied ? "Link copied!" : "Image saved!");
  }

  private async copyToClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  private handleDownloadClick(): void {
    if (!this.shareBlob) return;
    const url = URL.createObjectURL(this.shareBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stop-the-cheater-result.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Firefox cancels an in-flight download if the blob URL is revoked
    // synchronously after the click.
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  private async handleCopyLinkClick(): Promise<void> {
    if (!this.lastWinResult) return;
    const url = buildChallengeUrl({ name: this.overlay.getName(), moves: this.lastWinResult.moves, timeSeconds: this.lastWinResult.timeSeconds });
    if (await this.copyToClipboard(url)) this.overlay.flashCopied();
  }

  private updateRowButton(): void {
    const occupied = this.engineState.boat.size > 0;
    const enabled = occupied && this.gamePhase === "boarding";
    this.overlay.setRowEnabled(enabled);
  }

  // ---------- tuning harness ----------

  /** Which bank a person is standing on right now, in world terms. */
  private worldSideOf(id: PersonId): WorldSide {
    const engineSide: BankSide = this.engineState.left.has(id) ? "left" : "right";
    return toWorldSide(engineSide);
  }

  /**
   * Re-apply tuned camera + couple spacing to the live scene. Anyone who
   * is standing still gets moved to their new slot outright; anyone
   * walking, seated or mid-kiss is left alone — they resolve to the new
   * slots on their next move, and a snap mid-animation looks broken.
   */
  /**
   * Keep the river as long as the banks are deep, so winding the bank
   * depth up doesn't leave the water stopping short in mid-scene. (The
   * scattered foam chevrons stay where they are — they read as specks.)
   */
  private syncWaterToBankDepth(): void {
    const bankLength = Math.round(tuning.bankHalfDepth) * 2 + 1;
    this.water.mesh.scale.z = bankLength / WATER_LEN;
  }

  /** Bank tiles are built geometry, so a depth change means rebuilding them. */
  private rebuildBanks(): void {
    this.banks.forEach((bank) => {
      this.scene.remove(bank);
      disposeMerged(bank);
    });
    this.banks = [buildBank(LEFT_BANK_SPEC), buildBank(RIGHT_BANK_SPEC)];
    this.banks.forEach((bank) => this.scene.add(bank));
  }

  private applyTuning(): void {
    if (this.banksDirty) {
      this.banksDirty = false;
      this.rebuildBanks();
      this.syncWaterToBankDepth();
    }
    syncCameraPose(this.camera);
    this.resize();
    this.chars.forEach((entry) => {
      if (entry.state !== "idle") return;
      const slot = homeSlot(entry.id, this.worldSideOf(entry.id));
      entry.rig.root.position.set(slot.x, CHAR_HEIGHT_Y, slot.z);
    });
  }

  /**
   * Measure how close the idle characters come to the frame edge, which is
   * the thing the harness is really for: "it clips on mobile" is this
   * number going over 1.0 at a phone aspect ratio.
   */
  private updateDiagnostics(): void {
    const panel = this.tuningPanel;
    if (!panel) return;
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;

    // Screen-right in world space, so the character's width is measured
    // across the frame rather than along the axis it happens to face.
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0).setY(0).normalize();
    const probe = new THREE.Vector3();
    let worstX = 0;
    let worstY = 0;
    const clipped: string[] = [];

    allHomeSlots(ALL_PERSON_IDS).forEach(({ id, side, slot }) => {
      let personWorst = 0;
      for (const dy of [0, CHAR_TOP_Y]) {
        for (const dw of [-CHAR_HALF_W, CHAR_HALF_W]) {
          probe.set(slot.x + right.x * dw, CHAR_HEIGHT_Y + dy, slot.z + right.z * dw).project(this.camera);
          worstX = Math.max(worstX, Math.abs(probe.x));
          worstY = Math.max(worstY, Math.abs(probe.y));
          personWorst = Math.max(personWorst, Math.abs(probe.x), Math.abs(probe.y));
        }
      }
      if (personWorst > 1) clipped.push(`${id}/${side}`);
    });

    panel.setDiagnostics({
      widthPx: Math.round(w),
      heightPx: Math.round(h),
      aspect: w / Math.max(h, 1),
      frustum: computeFrustumSize(w / Math.max(h, 1)),
      worstX,
      worstY,
      clipped,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
    });
  }

  // ---------- resize ----------

  private resize(): void {
    const container = this.canvas.parentElement;
    const w = container?.clientWidth ?? window.innerWidth;
    const h = container?.clientHeight ?? window.innerHeight;
    if (!w || !h) return;
    applyAspectPreset(w / h);
    syncCameraPose(this.camera);
    resizeCamera(this.camera, w / h);
    this.renderer.setSize(w, h, false);
    this.nextDiagnosticsAt = 0;
  }

  // ---------- animate ----------

  private animate(): void {
    const rawDelta = this.clock.getDelta();
    const dt = Math.min(rawDelta, 0.05);
    const t = this.clock.elapsedTime;

    this.trackFrameRate(rawDelta);

    if (this.tuningDirty) {
      this.tuningDirty = false;
      this.applyTuning();
      this.nextDiagnosticsAt = 0;
    }
    if (this.tuningPanel && t >= this.nextDiagnosticsAt) {
      this.nextDiagnosticsAt = t + 0.2;
      this.updateDiagnostics();
    }

    this.water.uniforms.uTime.value = t;

    if (this.boatMoving) {
      this.boatCrossT = Math.min((t - this.boatCrossStart) / this.boatCrossDur, 1);
      const ep = this.boatCrossT < 0.5 ? 2 * this.boatCrossT * this.boatCrossT : 1 - Math.pow(-2 * this.boatCrossT + 2, 2) / 2;
      const fromX = dockXFor(this.crossFromWorld);
      const toX = dockXFor(this.crossToWorld);
      this.boat.position.x = fromX + (toX - fromX) * ep;
      if (this.boatCrossT >= 1) this.finishCrossing();
    }
    this.boat.position.y = 0.05 + Math.sin(t * 1.4) * 0.03;
    this.boat.rotation.z = Math.sin(t * 1.1) * 0.015;
    this.boat.rotation.x = Math.sin(t * 0.9 + 1) * 0.01;

    this.chars.forEach((entry) => this.updateCharacter(entry, t, dt));
    this.updateKiss(t);
    updateClouds(this.clouds, dt);

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Back off render resolution on a device that cannot hold frame rate.
   * One-way: a phone that drops to 1x stays there, because stepping back
   * up on a brief recovery just oscillates. Frames longer than 100ms are
   * stalls (tab switch, GC pause), not a frame-rate signal.
   */
  private trackFrameRate(rawDelta: number): void {
    if (this.pixelRatio <= MIN_PIXEL_RATIO) return;
    if (rawDelta <= 0 || rawDelta > 0.1) return;
    this.perfSamples++;
    if (rawDelta > 1 / 45) this.slowFrames++;
    if (this.perfSamples < 120) return;

    if (this.slowFrames > 60) {
      this.pixelRatio = Math.max(MIN_PIXEL_RATIO, this.pixelRatio - 0.25);
      this.renderer.setPixelRatio(this.pixelRatio);
      this.resize();
    }
    this.perfSamples = 0;
    this.slowFrames = 0;
  }

  private updateCharacter(entry: CharacterEntry, t: number, _dt: number): void {
    const root = entry.rig.root;

    if (entry.state === "walkingToBoat" || entry.state === "walkingToBank" || entry.state === "walkingToKiss") {
      const raw = Math.min((t - entry.walkStart) / entry.walkDur, 1);
      const p = raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;
      root.position.lerpVectors(entry.walkFrom, entry.walkTo, p);
      root.rotation.y = entry.walkFacing;

      const stride = Math.sin(t * STRIDE_FREQ + entry.rig.idlePhase);
      root.position.y += Math.abs(stride) * 0.032;
      root.rotation.z = stride * 0.045;
      if (entry.rig.legL) {
        entry.rig.legL.rotation.x = stride * 0.55;
        entry.rig.legR!.rotation.x = -stride * 0.55;
      }
      entry.rig.armL.rotation.x = -stride * 0.4;
      entry.rig.armR.rotation.x = stride * 0.4;

      if (raw >= 1) {
        root.rotation.z = 0;
        if (entry.rig.legL) {
          entry.rig.legL.rotation.x = 0;
          entry.rig.legR!.rotation.x = 0;
        }
        entry.rig.armL.rotation.x = 0;
        entry.rig.armR.rotation.x = 0;
        if (entry.state === "walkingToBoat") entry.state = "seated";
        else if (entry.state === "walkingToBank") {
          root.position.copy(entry.walkTo);
          entry.state = "idle";
        } else if (entry.state === "walkingToKiss") {
          root.position.copy(entry.walkTo);
          entry.state = "kissPose";
        }
      }
      return;
    }

    if (entry.state === "seated") {
      const seat = BOAT_LOCAL_SEATS[entry.seatIndex];
      root.position.set(this.boat.position.x + seat.x, this.boat.position.y + BOAT_FLOOR_H, this.boat.position.z + seat.z);
      root.rotation.y = idleFacingY();
      root.rotation.z = this.boat.rotation.z;
      return;
    }

    if (entry.state === "kissPose") {
      if (this.kissSeq && this.kissSeq.phase === "holding") {
        const elapsed = t - this.kissSeq.holdStart;
        const pulse = 1 + Math.max(0, Math.sin(elapsed * 6)) * 0.12 * Math.max(0, 1 - elapsed / 1.2);
        root.scale.setScalar(entry.rig.baseScale * pulse);
      }
      root.rotation.y = idleFacingY();
      return;
    }

    // idle — sturdy on the ground, facing the camera, with only a gentle
    // glance and arm sway on top of that — no vertical bob.
    root.position.y = CHAR_HEIGHT_Y;
    root.rotation.y = idleFacingY();
    entry.rig.head.rotation.y = Math.sin(t * 0.7 + entry.rig.idlePhase) * 0.16;
    entry.rig.armL.rotation.x = Math.sin(t * 1.0 + entry.rig.idlePhase) * 0.05;
    entry.rig.armR.rotation.x = Math.sin(t * 1.0 + entry.rig.idlePhase + 1.4) * 0.05;
  }

  private updateKiss(t: number): void {
    const seq = this.kissSeq;
    if (!seq) return;

    if (seq.phase === "walking") {
      const allArrived = seq.men.every((id) => this.chars.get(id)!.state === "kissPose");
      if (allArrived) {
        seq.phase = "holding";
        seq.holdStart = t;
        const womanEntry = this.chars.get(seq.woman)!;
        womanEntry.state = "kissPose";
        playKiss();
        this.spawnHeart(womanEntry.rig.root.position);
      }
      return;
    }

    // holding
    const elapsed = t - seq.holdStart;
    if (this.heartSprite) {
      const grow = Math.min(elapsed / 0.35, 1);
      const scale = 0.55 * grow;
      this.heartSprite.scale.set(scale, scale, 1);
      this.heartSprite.position.y += 0.006;
      const mat = this.heartSprite.material as THREE.SpriteMaterial;
      mat.opacity = elapsed > 1.6 ? Math.max(0, 1 - (elapsed - 1.6) / 0.6) : 1;
    }

    if (elapsed > 2.2 && this.gamePhase === "kissing") {
      this.kissSeq = null;
      this.gamePhase = "gameover";
      playGameOverSting();
      this.overlay.showGameOver();
      this.updateRowButton();
    }
  }

  dispose(): void {
    this.tuningPanel?.destroy();
    this.resizeObserver.disconnect();
    this.renderer.setAnimationLoop(null);
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh && !(obj as THREE.Sprite).isSprite) return;
      mesh.geometry?.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((m) => {
        (m as THREE.MeshStandardMaterial)?.map?.dispose();
        m?.dispose();
      });
    });
    this.scene.clear();
    this.renderer.dispose();
  }
}

let heartTexture: THREE.CanvasTexture | null = null;

function getHeartTexture(): THREE.CanvasTexture {
  heartTexture = heartTexture ?? makeHeartTexture();
  return heartTexture;
}

function makeHeartTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#FF4D8D";
  ctx.beginPath();
  ctx.moveTo(32, 54);
  ctx.bezierCurveTo(32, 50, 8, 34, 8, 20);
  ctx.bezierCurveTo(8, 8, 24, 4, 32, 18);
  ctx.bezierCurveTo(40, 4, 56, 8, 56, 20);
  ctx.bezierCurveTo(56, 34, 32, 50, 32, 54);
  ctx.closePath();
  ctx.fill();
  return new THREE.CanvasTexture(c);
}
