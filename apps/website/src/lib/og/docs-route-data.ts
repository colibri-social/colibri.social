import { defineRouteMiddleware } from "@astrojs/starlight/route-data";
import { ogImageFor } from "./url";

export const onRequest = defineRouteMiddleware((context) => {
	const route = context.locals.starlightRoute;
	const image = ogImageFor(
		{ kind: "docs", slug: route.entry.id },
		context.site ?? context.url,
	);
	const head = route.head.filter(
		(tag) =>
			tag.attrs?.property !== "og:image" && tag.attrs?.name !== "twitter:image",
	);
	head.push(
		{ tag: "meta", attrs: { property: "og:image", content: image } },
		{ tag: "meta", attrs: { name: "twitter:image", content: image } },
	);
	if (!head.some((tag) => tag.attrs?.name === "twitter:card")) {
		head.push({
			tag: "meta",
			attrs: { name: "twitter:card", content: "summary_large_image" },
		});
	}
	route.head = head;
});
