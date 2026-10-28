import type { APIRoute } from "astro";
import { respondOg, TTL } from "@/lib/og/respond";
import { pageTemplate } from "@/lib/og/templates";

const card = () =>
	pageTemplate({
		title: "Download Colibri",
		subtitle: "Get the app for your favorite devices.",
		path: "colibri.social/download",
		platforms: true,
	});

export const GET: APIRoute = () =>
	respondOg("download", TTL.static, async () => card(), card);
