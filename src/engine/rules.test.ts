import { describe, expect, it } from "vitest";
import { applyMove, checkViolation, isWin } from "./rules";
import { createInitialState, type GameState } from "./state";
import type { PersonId } from "./types";

describe("checkViolation", () => {
  it("is safe when no man is present, however the women are paired", () => {
    expect(checkViolation(["red-woman", "green-woman"])).toBe(false);
  });

  it("is safe when every woman present has her partner present", () => {
    expect(checkViolation(["red-man", "red-woman", "green-man", "green-woman"])).toBe(false);
  });

  it("is safe when a woman is alone with only her own partner", () => {
    expect(checkViolation(["red-man", "red-woman"])).toBe(false);
  });

  it("violates when a man is present and some other woman's partner is absent", () => {
    // red-man is present; green-woman's partner (green-man) is not.
    expect(checkViolation(["red-man", "red-woman", "green-woman"])).toBe(true);
  });

  it("violates even when the unattended woman is with her own reacting partner's rival", () => {
    // blue-woman has no partner present; red-man is a bystander who still reacts.
    expect(checkViolation(["red-man", "blue-woman"])).toBe(true);
  });
});

describe("applyMove — safe move", () => {
  it("moves people across and reports no violation", () => {
    const outcome = applyMove(createInitialState(), ["red-man", "red-woman"]);

    expect(outcome.violated).toBe(false);
    expect(outcome.violatedAt).toBeNull();
    expect(outcome.state.boatSide).toBe("right");
    expect(outcome.state.right).toEqual(new Set(["red-man", "red-woman"]));
    expect(outcome.state.left).toEqual(
      new Set(["green-man", "green-woman", "blue-man", "blue-woman"]),
    );
    expect(outcome.state.boat.size).toBe(0);
    expect(outcome.win).toBe(false);
  });
});

describe("applyMove — departure-bank violation", () => {
  it("is caught the instant the boat pushes off, before any arrival", () => {
    // Sending red-man off alone leaves red-woman on the left bank with her
    // partner gone, while green-man and blue-man are still there as
    // reacting bystanders.
    const initial = createInitialState();
    const outcome = applyMove(initial, ["red-man"]);

    expect(outcome.violated).toBe(true);
    expect(outcome.violatedAt).toBe("departure");
    expect(outcome.departureViolation.left).toBe(true);
    expect(outcome.departureViolation.right).toBe(false);
    expect(outcome.arrivalViolation).toBeNull();
    // The trip never completes once a departure violation is caught: the
    // boat stays docked on the left with red-man aboard, frozen mid-push-off
    // so the kiss animation can play out on the left bank.
    expect(outcome.state.boatSide).toBe("left");
    expect(outcome.state.boat).toEqual(new Set(["red-man"]));
    expect(outcome.state.left).toEqual(
      new Set(["red-woman", "green-man", "green-woman", "blue-man", "blue-woman"]),
    );
    expect(outcome.win).toBe(false);
  });
});

describe("applyMove — arrival-bank violation", () => {
  it("is caught once the boat lands, even if the departure bank was clean", () => {
    // Red couple crosses together first (safe both ways).
    let state: GameState = createInitialState();
    state = applyMove(state, ["red-man", "red-woman"]).state;

    // Sending red-woman back alone is safe to depart (right bank keeps only
    // red-man, no unattended woman) but strands her on the left, where
    // green-man and blue-man are waiting, without her own partner.
    const outcome = applyMove(state, ["red-woman"]);

    expect(outcome.violated).toBe(true);
    expect(outcome.violatedAt).toBe("arrival");
    expect(outcome.departureViolation.left).toBe(false);
    expect(outcome.departureViolation.right).toBe(false);
    expect(outcome.arrivalViolation?.left).toBe(true);
    expect(outcome.win).toBe(false);
  });
});

describe("isWin", () => {
  it("is false until all six people are on the right bank", () => {
    const state = applyMove(createInitialState(), ["red-man", "red-woman"]).state;
    expect(isWin(state)).toBe(false);
  });
});

describe("a known valid 11-move solution", () => {
  // Discovered via breadth-first search over this same engine (shortest
  // possible solution — the classic "jealous couples" puzzle has no
  // shorter one) and hand-verified to never trigger a violation.
  const SOLUTION: PersonId[][] = [
    ["red-man", "red-woman"],
    ["red-man"],
    ["green-woman", "blue-woman"],
    ["red-woman"],
    ["green-man", "blue-man"],
    ["green-woman", "green-man"],
    ["red-man", "green-man"],
    ["blue-woman"],
    ["red-woman", "green-woman"],
    ["blue-man"],
    ["blue-woman", "blue-man"],
  ];

  it("crosses all six people with zero violations along the way", () => {
    let state = createInitialState();

    for (const [index, trip] of SOLUTION.entries()) {
      const outcome = applyMove(state, trip);
      expect(outcome.violated, `move ${index + 1} (${trip.join(" + ")}) should be safe`).toBe(
        false,
      );
      state = outcome.state;
    }

    expect(isWin(state)).toBe(true);
  });

  it("is exactly 11 moves — the shortest possible solution", () => {
    expect(SOLUTION).toHaveLength(11);
  });
});

describe("sanity check: naive always-2-forward-1-back never wins", () => {
  function combinations<T>(arr: T[], k: number): T[][] {
    if (k === 0) return [[]];
    if (arr.length < k) return [];
    const [first, ...rest] = arr;
    const withFirst = combinations(rest, k - 1).map((c) => [first, ...c]);
    const withoutFirst = combinations(rest, k);
    return [...withFirst, ...withoutFirst];
  }

  function stateKey(state: GameState): string {
    return `${state.boatSide}:${[...state.left].sort().join(",")}`;
  }

  it("cannot reach a win when every forward trip carries 2 and every return carries 1", () => {
    const visited = new Set<string>();
    let winFound = false;

    function explore(state: GameState) {
      if (winFound) return;
      const key = stateKey(state);
      if (visited.has(key)) return;
      visited.add(key);

      const bank = state.boatSide === "left" ? state.left : state.right;
      const tripSize = state.boatSide === "left" ? 2 : 1;
      if (bank.size < tripSize) return;

      for (const combo of combinations([...bank], tripSize)) {
        const outcome = applyMove(state, combo);
        if (outcome.violated) continue;
        if (outcome.win) {
          winFound = true;
          return;
        }
        explore(outcome.state);
        if (winFound) return;
      }
    }

    explore(createInitialState());

    expect(winFound).toBe(false);
  });
});
