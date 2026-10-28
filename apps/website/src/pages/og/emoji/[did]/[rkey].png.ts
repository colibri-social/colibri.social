import type { APIRoute } from "astro";
import { getEmojiPackPreview } from "@/lib/og/emoji-pack";
import { remoteImage } from "@/lib/og/render";
import { respondOg, TTL } from "@/lib/og/respond";
import { emojiFallbackTemplate, emojiPackTemplate } from "@/lib/og/templates";

export const GET: APIRoute = ({ params }) => {
	const did = params.did ?? "";
	const rkey = params.rkey ?? "";
	return respondOg(
		`emoji:${did}:${rkey}`,
		TTL.live,
		async () => {
			if (!did.startsWith("did:") || !rkey) return null;
			const pack = await getEmojiPackPreview(did, rkey);
			if (!pack) return null;
			const images = (
				await Promise.all(
					pack.imageUrls.map((url) => remoteImage(url, 160, 160, "contain")),
				)
			).filter((image): image is string => image !== null);
			return emojiPackTemplate({
				name: pack.name,
				count: pack.count,
				images,
				creatorHandle: pack.creatorHandle,
			});
		},
		emojiFallbackTemplate,
	);
};
