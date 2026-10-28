import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import { respondOg, TTL } from "@/lib/og/respond";
import { pageTemplate } from "@/lib/og/templates";

const fallback = () =>
	pageTemplate({
		title: "Colibri Documentation",
		subtitle:
			"Learn about Colibri's architecture, specification, and how to contribute.",
		path: "colibri.social/docs",
		meta: "Documentation",
	});

export const GET: APIRoute = ({ params }) => {
	const slug = params.slug ?? "";
	return respondOg(
		`docs:${slug}`,
		TTL.content,
		async () => {
			const entries = await getCollection("docs");
			const entry = entries.find((e) => e.id === slug);
			if (!entry) return null;
			return pageTemplate({
				title: entry.data.title,
				subtitle: entry.data.description,
				path: "colibri.social/docs",
				meta: "Documentation",
			});
		},
		fallback,
	);
};
