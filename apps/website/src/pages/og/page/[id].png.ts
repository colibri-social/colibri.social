import { getEntry } from "astro:content";
import type { APIRoute } from "astro";
import { respondOg, TTL } from "@/lib/og/respond";
import { pageTemplate } from "@/lib/og/templates";

const PAGES: Record<string, { title: string; path: string }> = {
	about: { title: "About Colibri", path: "colibri.social/about" },
	faq: { title: "Frequently Asked Questions", path: "colibri.social/faq" },
	support: { title: "Support", path: "colibri.social/support" },
	privacy: { title: "Privacy Policy", path: "colibri.social/policy" },
	tos: { title: "Terms of Service", path: "colibri.social/tos" },
	imprint: { title: "Imprint", path: "colibri.social/imprint" },
};

const fallback = () =>
	pageTemplate({ title: "Colibri", path: "colibri.social" });

export const GET: APIRoute = ({ params }) => {
	const id = params.id ?? "";
	return respondOg(
		`page:${id}`,
		TTL.content,
		async () => {
			const page = PAGES[id];
			if (!page) return null;
			const entry = await getEntry("documents", id);
			return pageTemplate({
				title: page.title,
				subtitle: entry?.data.description,
				path: page.path,
			});
		},
		fallback,
	);
};
