import { getPerson, type PersonId, type Color } from "../engine";
import { tuning } from "./tuning";

/**
 * World-space side — which half of X=0 something sits on. NOT the same as
 * the engine's BankSide: the engine always starts everyone in its "left"
 * bank, but our art direction wants play to start on the bank nearest the
 * camera (positive X here). The mapping between the two lives in the game
 * orchestrator, not here — this module only knows world geometry.
 */
export type WorldSide = "left" | "right";

export interface Slot {
  x: number;
  z: number;
}

/**
 * Three couples at the corners of a triangle — one near the water
 * (closest to the boat), the other two spread wide further back — rather
 * than all three couples sitting in a single line across the bank.
 *
 * The spread itself (how far back, how far apart, how far each partner
 * stands from the other) is tuned live — see src/scene/tuning.ts.
 */
function corner(color: Color): { x: number; zCenter: number; pairGap: number } {
  switch (color) {
    case "red": // near-water apex
      return { x: tuning.frontX, zCenter: 0, pairGap: tuning.frontPairGap };
    case "green": // back-left corner
      return { x: tuning.backX, zCenter: -tuning.backSpreadZ, pairGap: tuning.backPairGap };
    case "blue": // back-right corner
      return { x: tuning.backX, zCenter: tuning.backSpreadZ, pairGap: tuning.backPairGap };
  }
}

/** Where a person stands when idle on the given world-space bank. */
export function homeSlot(personId: PersonId, side: WorldSide): Slot {
  const person = getPerson(personId);
  const spec = corner(person.color);
  const sign = person.gender === "man" ? -1 : 1;
  const x = side === "right" ? spec.x : -spec.x;
  const z = spec.zCenter + (sign * spec.pairGap) / 2;
  return { x, z };
}

/** Every idle home slot on both banks — what the tuning harness checks for clipping. */
export function allHomeSlots(personIds: readonly PersonId[]): { id: PersonId; side: WorldSide; slot: Slot }[] {
  const sides: WorldSide[] = ["right", "left"];
  return sides.flatMap((side) => personIds.map((id) => ({ id, side, slot: homeSlot(id, side) })));
}

export const CHAR_HEIGHT_Y = 0.5; // feet-on-ground baseline, matches bank tile top
