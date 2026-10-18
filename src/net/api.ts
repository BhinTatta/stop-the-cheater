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
  /** False when the deploy has no stats store configured — the numbers are
   * then placeholders and shouldn't be shown. */
  enabled: boolean;
  plays: number;
  completions: number;
  bestTime: number | null;
}

export async function fetchStats(): Promise<GameStats | null> {
  try {
    const res = await fetch("/api/stats");
    if (!res.ok) return null;
    const stats = (await res.json()) as Partial<GameStats>;
    if (!stats.enabled) return null;
    return {
      enabled: true,
      plays: stats.plays ?? 0,
      completions: stats.completions ?? 0,
      bestTime: stats.bestTime ?? null,
    };
  } catch {
    return null;
  }
}
