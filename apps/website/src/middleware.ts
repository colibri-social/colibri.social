import { MAINTENANCE } from "astro:env/server";
import { defineMiddleware } from "astro:middleware";
import { isMaintenanceExempt } from "./lib/maintenance/exempt-paths";
import { NOINDEX } from "./site";

const maintenanceResponse = (pathname: string) => {
	if (isMaintenanceExempt(pathname)) return undefined;

	return new Response(null, { status: 302, headers: { location: "/" } });
};

export const onRequest = defineMiddleware(async (context, next) => {
	const response =
		(MAINTENANCE && maintenanceResponse(context.url.pathname)) ||
		(await next());

	if (NOINDEX) response.headers.set("x-robots-tag", "noindex, nofollow");

	return response;
});
