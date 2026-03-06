import { REDIS_PASSWORD, REDIS_URL } from "astro:env/server";
import { createClient } from "redis";

let redisClient: ReturnType<typeof createClient> | undefined;

/**
 * Returns an existing Redis client instance if available, otherwise creates a new client instance.
 */
export const getRedisClient = async (): Promise<
	ReturnType<typeof createClient>
> => {
	if (redisClient) return redisClient;

	redisClient = await createClient({ password: REDIS_PASSWORD, url: REDIS_URL })
		.on("error", (err) => console.error("Redis Client Error", err))
		.connect();

	return redisClient;
};
