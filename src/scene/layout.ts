import { getPerson, type PersonId, type Color } from "../engine";

/**
 * World-space side — which half of X=0 something sits on. NOT the same as
 * the engine's BankSide: the engine always starts everyone in its "left"
 * bank, but our art direction wants play to start on the bank nearest the
 * camera (positive X here). The mapping between the two lives in the game
 * orchestrator, not here — this module only knows world geometry.
 */
export type WorldSide = "left" | "right";

/**
 * Three couples at the corners of a triangle — one near the water
 * (closest to the boat), the other two spread wide further back — rather
 * than all three couples sitting in a single line across the bank.
 * Kept inside the horizontal frustum at the default (unzoomed) framing;
 * verified against several real phone aspect ratios (see SPEC.md).
 */
const CORNER: Record<Color, { x: number; zCenter: number; pairGap: number }> = {
  red: { x: 2.6, zCenter: 0, pairGap: 0.8 }, // near-water apex
  green: { x: 4.1, zCenter: -1.1, pairGap: 0.5 }, // back-left corner
  blue: { x: 4.1, zCenter: 1.1, pairGap: 0.5 }, // back-right corner
};

export interface Slot {
  x: number;
  z: number;
}

/** Where a person stands when idle on the given world-space bank. */
export function homeSlot(personId: PersonId, side: WorldSide): Slot {
  const person = getPerson(personId);
  const spec = CORNER[person.color];
  const sign = person.gender === "man" ? -1 : 1;
  const x = side === "right" ? spec.x : -spec.x;
  const z = spec.zCenter + (sign * spec.pairGap) / 2;
  return { x, z };
}

export const CHAR_HEIGHT_Y = 0.5; // feet-on-ground baseline, matches bank tile top
