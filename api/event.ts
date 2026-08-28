import type { VercelRequest, VercelResponse } from "@vercel/node";
import { BEST_TIME_KEY, COMPLETIONS_KEY, PLAYS_KEY, redis } from "./_redis";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body ?? {};
  const { type, timeSeconds } = body as { type?: string; timeSeconds?: number };

  if (type === "attempt") {
    await redis.incr(PLAYS_KEY);
    res.status(200).json({ ok: true });
    return;
  }

  if (type === "complete") {
    await redis.incr(COMPLETIONS_KEY);

    if (typeof timeSeconds === "number" && Number.isFinite(timeSeconds) && timeSeconds > 0) {
      // Casual vanity stat, not a competitive leaderboard — a plain
      // get-compare-set is fine, no need for a transaction/lock here.
      const current = await redis.get<number>(BEST_TIME_KEY);
      if (current === null || timeSeconds < current) {
        await redis.set(BEST_TIME_KEY, timeSeconds);
      }
    }

    res.status(200).json({ ok: true });
    return;
  }

  res.status(400).json({ error: "Invalid event type" });
}
