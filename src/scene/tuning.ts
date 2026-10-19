/**
 * Live art-direction tuning values.
 *
 * Camera framing and couple spacing are the two things that can only be
 * judged by eye, on a real screen, at a real aspect ratio — so instead of
 * hard-coding them and rebuilding for every guess, they live here as
 * mutable values the on-screen tuning harness (src/ui/tuningPanel.ts)
 * drives. The numbers the harness reports get pasted back in as the new
 * DEFAULT_TUNING below, and the harness stops being load-bearing.
 *
 * The camera is described in spherical terms (azimuth/elevation) rather
 * than a raw offset vector because that is how the thing actually being
 * judged — "the angle is wrong" — is shaped.
 */
export interface Tuning {
  /** Compass angle of the camera around the target, degrees. 90 looks straight down -X; larger swings toward the far bank. */
  camAzimuthDeg: number;
  /** Height angle above the ground plane, degrees. Small = flatter, more side-on; large = more top-down. */
  camElevationDeg: number;
  /** Orthographic, so this does not change framing — only how much depth fits between the near and far clip planes. */
  camDistance: number;

  /** Look-at point: pans the whole frame. */
  targetX: number;
  targetY: number;
  targetZ: number;

  /** Vertical frustum height at aspect 1. Larger = zoomed out = less chance of clipping. */
  zoomBase: number;
  /** How much a wide window shrinks the frustum (0 = same frustum at every aspect). */
  zoomAspectPow: number;

  /** Distance from the river of the near-water couple (the triangle's apex). */
  frontX: number;
  /** Distance from the river of the two back couples. */
  backX: number;
  /** How far the two back couples sit either side of centre, along Z. */
  backSpreadZ: number;
  /** Gap between the two partners of the near-water couple. */
  frontPairGap: number;
  /** Gap between the two partners of each back couple. */
  backPairGap: number;

  /** Bank tile rows either side of z=0. Raise it if the banks stop short of the frame edge and sky shows through. */
  bankHalfDepth: number;
}

/**
 * Two measured presets, one per end of the aspect range, blended by
 * aspect at runtime. One set of numbers cannot serve both: the landscape
 * values put characters at 1.51x the frame half-width on a 394x852 phone,
 * and the portrait values overflow vertically (1.15x) on a 1229x566
 * window. Both were dialled in by eye on real screens with the harness
 * and verified by its own clip readout.
 *
 * Why the camera has to move with the aspect at all: screen-horizontal is
 * cos(azimuth) along world X and sin(azimuth) along Z, so azimuth trades
 * the X span (the two banks, 12 units apart) against the Z span (how far
 * the couples stand apart). A portrait frame can only afford the Z span,
 * hence 91.5; a landscape frame has room for the X span and gets depth
 * out of it, hence 106.5.
 */
export const PORTRAIT_TUNING: Readonly<Tuning> = {
  camAzimuthDeg: 91.5,
  camElevationDeg: 26,
  camDistance: 22,

  targetX: -2.1,
  targetY: -0.45,
  targetZ: 0.25,

  zoomBase: 11.6,
  zoomAspectPow: 0.85,

  frontX: 3.3,
  backX: 6.05,
  backSpreadZ: 1.4,
  frontPairGap: 0.75,
  backPairGap: 0.9,

  bankHalfDepth: 11,
};

export const LANDSCAPE_TUNING: Readonly<Tuning> = {
  camAzimuthDeg: 106.5,
  camElevationDeg: 23,
  camDistance: 22.5,

  targetX: -2.15,
  targetY: -0.4,
  targetZ: 0.7,

  zoomBase: 10.8,
  zoomAspectPow: 0.45,

  frontX: 3.3,
  backX: 6.05,
  backSpreadZ: 1.4,
  frontPairGap: 0.75,
  backPairGap: 0.9,

  bankHalfDepth: 11,
};

/** The aspect ratios the two presets were actually judged at. */
export const PORTRAIT_ASPECT = 394 / 852;
export const LANDSCAPE_ASPECT = 1229 / 566;

/** Kept for anything that wants a single static answer; the live scene uses the blend. */
export const DEFAULT_TUNING = PORTRAIT_TUNING;

/**
 * How far between the two presets a given aspect sits. Interpolating in
 * log(aspect) rather than aspect puts a square window at the midpoint,
 * which matches how the framing actually degrades either side of it.
 */
export function aspectBlend(aspect: number): number {
  const span = Math.log(LANDSCAPE_ASPECT) - Math.log(PORTRAIT_ASPECT);
  return Math.min(1, Math.max(0, (Math.log(Math.max(aspect, 0.01)) - Math.log(PORTRAIT_ASPECT)) / span));
}

export function tuningForAspect(aspect: number): Tuning {
  const t = aspectBlend(aspect);
  const out = {} as Tuning;
  (Object.keys(PORTRAIT_TUNING) as TuningKey[]).forEach((key) => {
    out[key] = PORTRAIT_TUNING[key] + (LANDSCAPE_TUNING[key] - PORTRAIT_TUNING[key]) * t;
  });
  out.bankHalfDepth = Math.round(out.bankHalfDepth);
  return out;
}

/** The live values every consumer reads. Mutated in place so imports stay valid. */
export const tuning: Tuning = { ...PORTRAIT_TUNING };

export type TuningKey = keyof Tuning;

export interface TuningField {
  key: TuningKey;
  label: string;
  group: "Camera" | "Framing" | "Couples" | "World";
  min: number;
  max: number;
  step: number;
  hint?: string;
}

export const TUNING_FIELDS: readonly TuningField[] = [
  { key: "camAzimuthDeg", label: "Azimuth", group: "Camera", min: 45, max: 165, step: 0.5, hint: "swing around" },
  { key: "camElevationDeg", label: "Elevation", group: "Camera", min: 2, max: 70, step: 0.5, hint: "height angle" },
  { key: "camDistance", label: "Distance", group: "Camera", min: 8, max: 30, step: 0.5, hint: "clip range only" },

  { key: "zoomBase", label: "Zoom base", group: "Framing", min: 5, max: 20, step: 0.1, hint: "bigger = zoomed out" },
  { key: "zoomAspectPow", label: "Aspect comp", group: "Framing", min: 0, max: 1.5, step: 0.05 },
  { key: "targetX", label: "Pan X", group: "Framing", min: -6, max: 6, step: 0.05 },
  { key: "targetY", label: "Pan Y", group: "Framing", min: -2, max: 4, step: 0.05 },
  { key: "targetZ", label: "Pan Z", group: "Framing", min: -6, max: 6, step: 0.05 },

  { key: "frontX", label: "Front couple X", group: "Couples", min: 2.2, max: 8, step: 0.05, hint: "near the water" },
  { key: "backX", label: "Back couples X", group: "Couples", min: 2.2, max: 10, step: 0.05 },
  { key: "backSpreadZ", label: "Back spread Z", group: "Couples", min: 0, max: 4, step: 0.05, hint: "apart from each other" },
  { key: "frontPairGap", label: "Front pair gap", group: "Couples", min: 0.2, max: 3, step: 0.05, hint: "man to woman" },
  { key: "backPairGap", label: "Back pair gap", group: "Couples", min: 0.2, max: 3, step: 0.05 },

  { key: "bankHalfDepth", label: "Bank depth", group: "World", min: 4, max: 12, step: 1, hint: "rows each side" },
];

const FIELD_BY_KEY = new Map(TUNING_FIELDS.map((f) => [f.key, f]));

type Listener = (changed: TuningKey) => void;
const listeners: Listener[] = [];

export function onTuningChange(cb: Listener): void {
  listeners.push(cb);
}

function clampToField(key: TuningKey, value: number): number {
  const field = FIELD_BY_KEY.get(key);
  if (!field || !Number.isFinite(value)) return tuning[key];
  return Math.min(field.max, Math.max(field.min, value));
}

function applyValue(key: TuningKey, value: number): void {
  const next = clampToField(key, value);
  if (tuning[key] === next) return;
  tuning[key] = next;
  listeners.forEach((cb) => cb(key));
}

/**
 * True while the aspect presets are driving the values. Any hand-set
 * value (harness slider, or a ?t= link) pins the scene instead, so a
 * resize mid-tuning doesn't yank the numbers out from under you.
 */
let autoFromAspect = true;
let lastAspect = PORTRAIT_ASPECT;

export function isAutoTuning(): boolean {
  return autoFromAspect;
}

export function setTuning(key: TuningKey, value: number): void {
  autoFromAspect = false;
  applyValue(key, value);
}

/** Re-blend for a new viewport shape. No-op once anything has been set by hand. */
export function applyAspectPreset(aspect: number): void {
  lastAspect = aspect;
  if (!autoFromAspect) return;
  const next = tuningForAspect(aspect);
  (Object.keys(next) as TuningKey[]).forEach((key) => applyValue(key, next[key]));
}

export function resetTuning(): void {
  autoFromAspect = true;
  const next = tuningForAspect(lastAspect);
  (Object.keys(next) as TuningKey[]).forEach((key) => applyValue(key, next[key]));
}

export function currentAspect(): number {
  return lastAspect;
}

// ---------- persistence ----------

const STORAGE_KEY = "stc.tuning.v1";

function applyRecord(record: unknown): void {
  if (!record || typeof record !== "object") return;
  for (const [key, value] of Object.entries(record as Record<string, unknown>)) {
    if (FIELD_BY_KEY.has(key as TuningKey) && typeof value === "number") {
      setTuning(key as TuningKey, value);
    }
  }
}

/** Values the harness is driving, as a plain object (only what differs from default is worth reading, but all of it is cheap). */
export function tuningRecord(): Record<string, number> {
  const out: Record<string, number> = {};
  TUNING_FIELDS.forEach((f) => {
    out[f.key] = tuning[f.key];
  });
  return out;
}

export function saveTuning(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tuningRecord()));
  } catch {
    // private mode / blocked storage — the harness still works, it just won't survive a reload
  }
}

export function clearSavedTuning(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing to do
  }
}

/**
 * Load overrides, URL first (so a link from the laptop can be opened on a
 * phone and show the same framing) then whatever the last session left in
 * storage.
 */
export function loadTuningOverrides(): void {
  const raw = new URLSearchParams(location.search).get("t");
  if (raw) {
    try {
      applyRecord(JSON.parse(decodeURIComponent(raw)));
      return;
    } catch {
      // malformed link — fall through to storage
    }
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) applyRecord(JSON.parse(stored));
  } catch {
    // nothing to do
  }
}

/** A link that reopens the current values (handy for checking laptop values on a phone). */
export function tuningLink(): string {
  const payload = encodeURIComponent(JSON.stringify(tuningRecord()));
  return `${location.origin}${location.pathname}?tune=1&t=${payload}`;
}

/** Is the harness wanted on this load? `?tune=1`, or any dev-server run. */
export function tuningEnabled(): boolean {
  const params = new URLSearchParams(location.search);
  if (params.get("tune") === "0") return false;
  if (params.has("tune") || params.has("t")) return true;
  return import.meta.env.DEV;
}
