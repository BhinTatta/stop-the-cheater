import { ALL_PERSON_IDS, type PersonId } from "./types";

export type BankSide = "left" | "right";

export interface GameState {
  left: Set<PersonId>;
  right: Set<PersonId>;
  boat: Set<PersonId>;
  boatSide: BankSide;
}

export function createInitialState(): GameState {
  return {
    left: new Set(ALL_PERSON_IDS),
    right: new Set(),
    boat: new Set(),
    boatSide: "left",
  };
}

export function cloneState(state: GameState): GameState {
  return {
    left: new Set(state.left),
    right: new Set(state.right),
    boat: new Set(state.boat),
    boatSide: state.boatSide,
  };
}
