import type { VercelRequest, VercelResponse } from "@vercel/node";
import { BEST_TIME_KEY, COMPLETIONS_KEY, PLAYS_KEY, redis } from "./_redis";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const [plays, completions, bestTime] = await Promise.all([
    redis.get<number>(PLAYS_KEY),
    redis.get<number>(COMPLETIONS_KEY),
    redis.get<number>(BEST_TIME_KEY),
  ]);

  res.status(200).json({
    plays: plays ?? 0,
    completions: completions ?? 0,
    bestTime: bestTime ?? null,
  });
}
