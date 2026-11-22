export type OgImage =
	| { kind: "home" }
	| { kind: "download" }
	| { kind: "document"; id: string }
	| { kind: "blog" }
	| { kind: "blog-post"; rkey: string }
	| { kind: "docs"; slug: string }
	| { kind: "invite"; code: string }
	| { kind: "emoji-pack"; did: string; rkey: string };

const pathFor = (image: OgImage) => {
	switch (image.kind) {
		case "home":
			return "/og/home.png";
		case "download":
			return "/og/download.png";
		case "document":
			return `/og/page/${encodeURIComponent(image.id)}.png`;
		case "blog":
			return "/og/blog.png";
		case "blog-post":
			return `/og/blog/${encodeURIComponent(image.rkey)}.png`;
		case "docs":
			return `/og/docs/${image.slug.split("/").map(encodeURIComponent).join("/")}.png`;
		case "invite":
			return `/og/invite/${encodeURIComponent(image.code)}.png`;
		case "emoji-pack":
			return `/og/emoji/${encodeURIComponent(image.did)}/${encodeURIComponent(image.rkey)}.png`;
	}
};

export const ogImageFor = (image: OgImage, site?: URL | string) => {
	const path = pathFor(image);
	return site ? new URL(path, site).toString() : path;
};
