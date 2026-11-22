import { MAINTENANCE } from "astro:env/server";
import { defineMiddleware } from "astro:middleware";
import {
	isMaintenanceExempt,
	normalizePathname,
} from "./lib/maintenance/exempt-paths";
import { legacyOAuthResponse } from "./lib/maintenance/legacy-oauth";
import { NOINDEX } from "./site";

const maintenanceResponse = (request: Request, pathname: string) => {
	if (request.method === "GET" || request.method === "HEAD") {
		const legacy = legacyOAuthResponse(normalizePathname(pathname));

		if (legacy) return legacy;
	}

	if (isMaintenanceExempt(pathname)) return undefined;

	return new Response(null, { status: 302, headers: { location: "/" } });
};

export const onRequest = defineMiddleware(async (context, next) => {
	const response =
		(MAINTENANCE &&
			maintenanceResponse(context.request, context.url.pathname)) ||
		(await next());

	if (NOINDEX) response.headers.set("x-robots-tag", "noindex, nofollow");

	return response;
});
