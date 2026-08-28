export type GameEventType = "attempt" | "complete";

/**
 * Fire-and-forget: the game must be fully playable with the backend
 * offline, so failures here are swallowed rather than surfaced.
 */
export async function postEvent(type: GameEventType, timeSeconds?: number): Promise<void> {
  try {
    await fetch("/api/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, timeSeconds }),
      keepalive: true,
    });
  } catch {
    // best-effort
  }
}

export interface GameStats {
  plays: number;
  completions: number;
  bestTime: number | null;
}

export async function fetchStats(): Promise<GameStats | null> {
  try {
    const res = await fetch("/api/stats");
    if (!res.ok) return null;
    return (await res.json()) as GameStats;
  } catch {
    return null;
  }
}
