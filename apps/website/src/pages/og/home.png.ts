import type { APIRoute } from "astro";
import { respondOg, TTL } from "@/lib/og/respond";
import { homeTemplate } from "@/lib/og/templates";

export const GET: APIRoute = () =>
	respondOg("home", TTL.static, async () => homeTemplate(), homeTemplate);
