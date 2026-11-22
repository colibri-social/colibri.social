import shell from "@colibri-social/app/dist/index.html?raw";
import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = () =>
	new Response(shell, {
		headers: {
			"content-type": "text/html; charset=utf-8",
			"cache-control": "no-cache",
		},
	});
