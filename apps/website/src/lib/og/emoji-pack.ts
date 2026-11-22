import { DEFAULT_APPVIEW_URL } from "@colibri-social/lib";
import { resolveHandle } from "@/lib/handle";

const REQUEST_TIMEOUT_MS = 3000;
const MAX_EMOJI = 8;

type WireImage = { cid: string; format: string; animated: boolean };

type WireEmoji = { uri: string; owner: string; images: WireImage[] };

type WirePack = { uri: string; name: string; emojis: string[] };

type CatalogResponse = {
	catalog: { emojis: WireEmoji[]; packs: WirePack[] };
};

export type EmojiPackPreview = {
	name: string;
	count: number;
	imageUrls: string[];
	creatorHandle?: string;
};

const STATIC_FORMATS = new Set(["png", "webp", "gif", "apng"]);

const blobUrl = (did: string, cid: string) => {
	const url = new URL(
		"/xrpc/social.colibri.beta.blob.get",
		DEFAULT_APPVIEW_URL,
	);
	url.searchParams.set("did", did);
	url.searchParams.set("cid", cid);
	return url.toString();
};

export const getEmojiPackPreview = async (
	did: string,
	rkey: string,
): Promise<EmojiPackPreview | null> => {
	const url = new URL(
		"/xrpc/social.colibri.beta.emoji.getCatalog",
		DEFAULT_APPVIEW_URL,
	);
	url.searchParams.set("owner", did);

	try {
		const res = await fetch(url, {
			headers: { accept: "application/json" },
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
		if (!res.ok) return null;
		const { catalog } = (await res.json()) as CatalogResponse;
		const pack = catalog.packs.find((p) => p.uri.endsWith(`/${rkey}`));
		if (!pack) return null;

		const byUri = new Map(catalog.emojis.map((e) => [e.uri, e]));
		const imageUrls = pack.emojis
			.map((uri) => byUri.get(uri))
			.flatMap((emoji) => {
				const image = emoji?.images.find((i) => STATIC_FORMATS.has(i.format));
				return emoji && image ? [blobUrl(emoji.owner, image.cid)] : [];
			})
			.slice(0, MAX_EMOJI);

		const creatorHandle = await resolveHandle(did);
		return {
			name: pack.name,
			count: pack.emojis.length,
			imageUrls,
			creatorHandle: creatorHandle ?? undefined,
		};
	} catch {
		return null;
	}
};
