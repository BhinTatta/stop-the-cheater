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
 * Starting points for the harness, not confirmed-by-eye values.
 *
 * Phase 8's camera (offset 13.5/3.7/-3.7 = azimuth 105.3, elevation
 * 14.8) put the characters 2.1x outside the frame on a 390x844 phone,
 * which is the reported clipping. The cause is geometric: screen-
 * horizontal is (cos azimuth) along X and (sin azimuth) along Z, so
 * every degree of azimuth away from 90 drags the far bank — 10 units
 * away along X — sideways out of a portrait frame, and costs roughly
 * 0.4 of zoomBase to claw back. 92 keeps a little asymmetry for depth
 * and still fits. targetZ is 0 rather than 1.1 for the same reason:
 * off-centre panning spends the narrow axis.
 *
 * Couple spacing is wider than Phase 8's (frontX 2.6, backX 4.1,
 * backSpreadZ 1.1, gaps 0.8/0.5) — they read as one clump. Note the
 * trade this implies on a phone: backSpreadZ is almost exactly the
 * screen-horizontal axis, so spreading the couples and zooming in pull
 * against each other directly.
 */
export const DEFAULT_TUNING: Readonly<Tuning> = {
  camAzimuthDeg: 92,
  camElevationDeg: 26,
  camDistance: 14.5,

  targetX: 0,
  targetY: 0.15,
  targetZ: 0,

  zoomBase: 12.8,
  zoomAspectPow: 0.3,

  frontX: 3.0,
  backX: 5.0,
  backSpreadZ: 1.75,
  frontPairGap: 1.0,
  backPairGap: 0.9,

  bankHalfDepth: 4,
};

/** The live values every consumer reads. Mutated in place so imports stay valid. */
export const tuning: Tuning = { ...DEFAULT_TUNING };

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

export function setTuning(key: TuningKey, value: number): void {
  const next = clampToField(key, value);
  if (tuning[key] === next) return;
  tuning[key] = next;
  listeners.forEach((cb) => cb(key));
}

export function resetTuning(): void {
  (Object.keys(DEFAULT_TUNING) as TuningKey[]).forEach((key) => setTuning(key, DEFAULT_TUNING[key]));
}

export function isTuningDefault(): boolean {
  return (Object.keys(DEFAULT_TUNING) as TuningKey[]).every((key) => tuning[key] === DEFAULT_TUNING[key]);
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
