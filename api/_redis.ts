import { Redis } from "@upstash/redis";

export const PLAYS_KEY = "stop-the-cheater:plays";
export const COMPLETIONS_KEY = "stop-the-cheater:completions";
export const BEST_TIME_KEY = "stop-the-cheater:best_time";

let client: Redis | null = null;

/**
 * The counters are a nice-to-have, not a dependency: with no Upstash
 * credentials set the endpoints stay up and simply report nothing, so the
 * game deploys and plays with no backend setup at all. Fill in
 * UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN later to switch the
 * counters on — nothing else has to change.
 */
export function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  client ??= new Redis({ url, token });
  return client;
}
