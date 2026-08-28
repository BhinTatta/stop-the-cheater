import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const PLAYS_KEY = "stop-the-cheater:plays";
export const COMPLETIONS_KEY = "stop-the-cheater:completions";
export const BEST_TIME_KEY = "stop-the-cheater:best_time";
