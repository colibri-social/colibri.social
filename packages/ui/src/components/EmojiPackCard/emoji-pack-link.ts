import { CLIENT_ORIGIN, clientOrigin } from "@colibri-social/lib";

export const EMOJI_PACK_SHARE_ORIGIN = CLIENT_ORIGIN;

export const EMOJI_PACK_SHARE_ORIGINS: readonly string[] = [
	EMOJI_PACK_SHARE_ORIGIN,
	"https://colibri.social",
	"https://next.colibri.social",
];

const currentOrigin = () =>
	typeof location === "undefined" ? undefined : location.origin;

export type EmojiPackShareTarget = { did: string; rkey: string };

const DID = /^did:[a-z]+:[a-zA-Z0-9._:%-]+$/;
const RKEY = /^[a-zA-Z0-9._:~-]{1,512}$/;

export const emojiPackShareUrl = (
	target: EmojiPackShareTarget,
	origin = clientOrigin(),
) => `${origin}/emoji/${target.did}/${encodeURIComponent(target.rkey)}`;

export const parseEmojiPackShareUrl = (
	value: string,
	origins?: readonly string[],
): EmojiPackShareTarget | undefined => {
	const here = currentOrigin();
	const allowed =
		origins ??
		(here ? [...EMOJI_PACK_SHARE_ORIGINS, here] : EMOJI_PACK_SHARE_ORIGINS);
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return undefined;
	}
	if (!allowed.includes(url.origin)) return undefined;
	const parts = url.pathname.split("/").filter(Boolean);
	if (parts.length !== 3 || parts[0] !== "emoji") return undefined;
	let did: string;
	let rkey: string;
	try {
		did = decodeURIComponent(parts[1] ?? "");
		rkey = decodeURIComponent(parts[2] ?? "");
	} catch {
		return undefined;
	}
	if (!DID.test(did) || !RKEY.test(rkey) || rkey === "." || rkey === "..")
		return undefined;
	return { did, rkey };
};
