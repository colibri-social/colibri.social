import { defineMiddleware } from "astro:middleware";
import { NOINDEX } from "./site";

export const onRequest = defineMiddleware(async (_context, next) => {
	const response = await next();
	if (NOINDEX) response.headers.set("x-robots-tag", "noindex, nofollow");
	return response;
});
