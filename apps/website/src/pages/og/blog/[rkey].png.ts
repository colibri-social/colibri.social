import type { APIRoute } from "astro";
import { blobUrl } from "@/lib/blog/blob";
import { getPost } from "@/lib/blog/posts";
import { OG_HEIGHT, OG_WIDTH, remoteImage } from "@/lib/og/render";
import { respondOg, TTL } from "@/lib/og/respond";
import { pageTemplate } from "@/lib/og/templates";

const fallback = () =>
	pageTemplate({
		title: "The Colibri Blog",
		subtitle: "News and updates about Colibri.",
		path: "colibri.social/blog",
	});

const formatDate = (value: string) =>
	new Date(value).toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});

export const GET: APIRoute = ({ params }) => {
	const rkey = params.rkey ?? "";
	return respondOg(
		`blog:${rkey}`,
		TTL.content,
		async () => {
			const post = rkey ? await getPost(rkey) : undefined;
			if (!post) return null;
			const coverUrl = blobUrl(post.doc.coverImage);
			const cover = coverUrl
				? await remoteImage(coverUrl, OG_WIDTH, OG_HEIGHT)
				: null;
			return pageTemplate({
				title: post.doc.title,
				path: "colibri.social/blog",
				meta: post.doc.publishedAt
					? formatDate(post.doc.publishedAt)
					: undefined,
				cover,
			});
		},
		fallback,
	);
};
