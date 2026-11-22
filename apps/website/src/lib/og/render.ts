import { satoriAstroOG } from "satori-astro";
import { html } from "satori-html";
import sharp from "sharp";
import hanken500 from "@/assets/og/HankenGrotesk-500.ttf?inline";
import hanken700 from "@/assets/og/HankenGrotesk-700.ttf?inline";
import hanken900 from "@/assets/og/HankenGrotesk-900.ttf?inline";
import stardom from "@/assets/og/Stardom-Regular.woff?inline";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const REQUEST_TIMEOUT_MS = 3000;
const MAX_REMOTE_BYTES = 8 * 1024 * 1024;

const decodeDataUrl = (dataUrl: string) =>
	Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");

const fonts = [
	{ name: "Hanken Grotesk", data: decodeDataUrl(hanken500), weight: 500 },
	{ name: "Hanken Grotesk", data: decodeDataUrl(hanken700), weight: 700 },
	{ name: "Hanken Grotesk", data: decodeDataUrl(hanken900), weight: 900 },
	{ name: "Stardom", data: decodeDataUrl(stardom), weight: 400 },
] as const;

const ENTITIES: Record<string, string> = {
	"&lt;": "<",
	"&gt;": ">",
	"&quot;": '"',
	"&#39;": "'",
	"&amp;": "&",
};

const decodeEntities = (text: string) =>
	text.replace(/&(lt|gt|quot|#39|amp);/g, (entity) => ENTITIES[entity]);

type Node = { props?: { children?: unknown } };

const decodeTree = (node: unknown): unknown => {
	if (typeof node === "string") return decodeEntities(node);
	if (Array.isArray(node)) return node.map(decodeTree);
	const element = node as Node;
	if (element?.props?.children !== undefined) {
		return {
			...element,
			props: { ...element.props, children: decodeTree(element.props.children) },
		};
	}
	return node;
};

export const esc = (value: string) =>
	value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");

export const renderOg = async (markup: string): Promise<Buffer> => {
	const template = decodeTree(html(markup)) as ReturnType<typeof html>;
	return satoriAstroOG({
		template,
		width: OG_WIDTH,
		height: OG_HEIGHT,
	}).toImage({
		satori: {
			fonts: fonts.map((font) => ({ ...font, style: "normal" as const })),
		},
	});
};

export const pngResponse = (png: Buffer, maxAgeSeconds: number) =>
	new Response(new Uint8Array(png), {
		headers: {
			"content-type": "image/png",
			"cache-control": `public, max-age=${maxAgeSeconds}, s-maxage=${maxAgeSeconds}, stale-while-revalidate=86400`,
		},
	});

export const remoteImage = async (
	url: string,
	width: number,
	height: number,
	fit: "cover" | "contain" = "cover",
): Promise<string | null> => {
	try {
		const parsed = new URL(url);
		if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
			return null;
		}
		const res = await fetch(parsed, {
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
		if (!res.ok) return null;
		const length = Number(res.headers.get("content-length") ?? 0);
		if (length > MAX_REMOTE_BYTES) return null;
		const bytes = Buffer.from(await res.arrayBuffer());
		if (bytes.length > MAX_REMOTE_BYTES) return null;
		const png = await sharp(bytes, { animated: false })
			.resize(width, height, {
				fit,
				background: { r: 0, g: 0, b: 0, alpha: 0 },
			})
			.png()
			.toBuffer();
		return `data:image/png;base64,${png.toString("base64")}`;
	} catch {
		return null;
	}
};

const cache = new Map<string, { png: Buffer; expires: number }>();
const CACHE_LIMIT = 200;

export const cachedRender = async (
	key: string,
	ttlMs: number,
	build: () => Promise<Buffer>,
): Promise<Buffer> => {
	const hit = cache.get(key);
	if (hit && hit.expires > Date.now()) return hit.png;
	const png = await build();
	if (cache.size >= CACHE_LIMIT) {
		const oldest = cache.keys().next().value;
		if (oldest !== undefined) cache.delete(oldest);
	}
	cache.set(key, { png, expires: Date.now() + ttlMs });
	return png;
};
