export const MAX_NAME_LENGTH = 20;

export interface ChallengeInfo {
  name: string;
  moves: number;
  timeSeconds: number;
}

/** Reads ?name=&moves=&time= from the current URL. No validation beyond
 * basic sanity — a faked score in the URL is harmless, this isn't a
 * leaderboard, but garbage values shouldn't crash the intro banner. */
export function parseChallengeFromUrl(): ChallengeInfo | null {
  const params = new URLSearchParams(window.location.search);
  const movesRaw = params.get("moves");
  const timeRaw = params.get("time");
  if (!movesRaw || !timeRaw) return null;

  const moves = Number.parseInt(movesRaw, 10);
  const timeSeconds = Number.parseFloat(timeRaw);
  if (!Number.isFinite(moves) || moves <= 0 || moves > 999) return null;
  if (!Number.isFinite(timeSeconds) || timeSeconds <= 0 || timeSeconds > 100000) return null;

  const name = (params.get("name") ?? "").slice(0, MAX_NAME_LENGTH);
  return { name, moves, timeSeconds };
}

export function buildChallengeUrl(info: { name: string; moves: number; timeSeconds: number }): string {
  const url = new URL(window.location.origin + window.location.pathname);
  const trimmedName = info.name.trim().slice(0, MAX_NAME_LENGTH);
  if (trimmedName) url.searchParams.set("name", trimmedName);
  url.searchParams.set("moves", String(info.moves));
  url.searchParams.set("time", info.timeSeconds.toFixed(2));
  return url.toString();
}

export function resultSentence(name: string, moves: number): string {
  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
  return trimmed ? `${trimmed} solved it in ${moves} moves.` : `I solved it in ${moves} moves.`;
}

/** Plain text only — callers must bind this via textContent, never
 * innerHTML, since `info.name` originates from an untrusted URL param. */
export function challengeBannerText(info: ChallengeInfo): string {
  const displayName = info.name.trim() || "Someone";
  return `${displayName} solved it in ${info.moves} moves. Can you beat them?`;
}
