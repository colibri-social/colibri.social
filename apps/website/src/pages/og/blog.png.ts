import type { APIRoute } from "astro";
import { respondOg, TTL } from "@/lib/og/respond";
import { pageTemplate } from "@/lib/og/templates";

const card = () =>
	pageTemplate({
		title: "The Colibri Blog",
		subtitle: "News and updates about Colibri.",
		path: "colibri.social/blog",
	});

export const GET: APIRoute = () =>
	respondOg("blog", TTL.static, async () => card(), card);
