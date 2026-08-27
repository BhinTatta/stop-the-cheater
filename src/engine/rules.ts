import { ALL_PERSON_IDS, getPartnerId, getPerson, type PersonId } from "./types";
import { type BankSide, cloneState, type GameState } from "./state";

/**
 * A bank is in violation if it has a woman whose partner is not present
 * there, and at least one man is present there (any man — even one who's
 * with his own partner; he still reacts).
 */
export function checkViolation(people: Iterable<PersonId>): boolean {
  const bank = new Set(people);
  let hasMan = false;
  let hasUnattendedWoman = false;

  for (const id of bank) {
    const person = getPerson(id);
    if (person.gender === "man") {
      hasMan = true;
    } else if (!bank.has(getPartnerId(id))) {
      hasUnattendedWoman = true;
    }
  }

  return hasMan && hasUnattendedWoman;
}

export function isWin(state: GameState): boolean {
  return state.right.size === ALL_PERSON_IDS.length;
}

/** Moves a person from the bank the boat is currently docked at onto the boat. */
export function board(state: GameState, personId: PersonId): GameState {
  const bank = state[state.boatSide];
  if (!bank.has(personId)) {
    throw new Error(`${personId} is not on the ${state.boatSide} bank`);
  }
  if (state.boat.size >= 2) {
    throw new Error("The boat is full");
  }

  const next = cloneState(state);
  next[state.boatSide].delete(personId);
  next.boat.add(personId);
  return next;
}

/** Moves a person off the boat, back onto the bank it is currently docked at. */
export function unboard(state: GameState, personId: PersonId): GameState {
  if (!state.boat.has(personId)) {
    throw new Error(`${personId} is not aboard the boat`);
  }

  const next = cloneState(state);
  next.boat.delete(personId);
  next[state.boatSide].add(personId);
  return next;
}

export interface BankViolation {
  left: boolean;
  right: boolean;
}

export type ViolationStage = "departure" | "arrival" | null;

export interface RowOutcome {
  state: GameState;
  departureViolation: BankViolation;
  arrivalViolation: BankViolation | null;
  violated: boolean;
  violatedAt: ViolationStage;
  win: boolean;
}

/**
 * Rows the boat (with whoever is currently boarded) to the opposite bank.
 * Checks the departure bank the instant the boat pushes off — a stranding
 * move ends the trip right there, before any arrival — then checks both
 * banks again on arrival.
 */
export function row(state: GameState): RowOutcome {
  if (state.boat.size === 0) {
    throw new Error("Cannot row an empty boat");
  }
  if (state.boat.size > 2) {
    throw new Error("The boat can carry at most 2 people");
  }

  const departureViolation: BankViolation = {
    left: checkViolation(state.left),
    right: checkViolation(state.right),
  };

  if (departureViolation.left || departureViolation.right) {
    return {
      state,
      departureViolation,
      arrivalViolation: null,
      violated: true,
      violatedAt: "departure",
      win: false,
    };
  }

  const destination: BankSide = state.boatSide === "left" ? "right" : "left";
  const next = cloneState(state);
  for (const personId of state.boat) {
    next.boat.delete(personId);
    next[destination].add(personId);
  }
  next.boatSide = destination;

  const arrivalViolation: BankViolation = {
    left: checkViolation(next.left),
    right: checkViolation(next.right),
  };
  const violated = arrivalViolation.left || arrivalViolation.right;

  return {
    state: next,
    departureViolation,
    arrivalViolation,
    violated,
    violatedAt: violated ? "arrival" : null,
    win: !violated && isWin(next),
  };
}

/**
 * Convenience wrapper for a full one-way trip: boards 1 or 2 people from
 * whichever bank the boat is docked at, then rows. Equivalent to calling
 * `board()` for each person followed by `row()`.
 */
export function applyMove(state: GameState, peopleIds: PersonId[]): RowOutcome {
  if (peopleIds.length !== 1 && peopleIds.length !== 2) {
    throw new Error("A move must carry 1 or 2 people");
  }
  if (new Set(peopleIds).size !== peopleIds.length) {
    throw new Error("A move cannot carry the same person twice");
  }

  let working = state;
  for (const personId of peopleIds) {
    working = board(working, personId);
  }

  return row(working);
}
