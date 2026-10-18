import type { VercelRequest, VercelResponse } from "@vercel/node";
import { BEST_TIME_KEY, COMPLETIONS_KEY, PLAYS_KEY, getRedis } from "./_redis";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // `enabled: false` tells the client there are no real numbers to show, so
  // it hides the play counter rather than rendering a zero.
  const redis = getRedis();
  if (!redis) {
    res.status(200).json({ enabled: false, plays: 0, completions: 0, bestTime: null });
    return;
  }

  const [plays, completions, bestTime] = await Promise.all([
    redis.get<number>(PLAYS_KEY),
    redis.get<number>(COMPLETIONS_KEY),
    redis.get<number>(BEST_TIME_KEY),
  ]);

  res.status(200).json({
    enabled: true,
    plays: plays ?? 0,
    completions: completions ?? 0,
    bestTime: bestTime ?? null,
  });
}
