import {
	clientOrigin,
	isChannelSpace,
	isThreadSpace,
} from "@colibri-social/lib";
import {
	isAtUri,
	parseEmojiPackShareUrl,
	pdslsHrefFor,
	type RichTextLinkTarget,
} from "@colibri-social/ui";
import { emojiRegistry } from "../../../data/emoji";
import { skeyOf } from "../../../data/ids";
import { MESSAGE_COLLECTION } from "../../../data/source";
import { routeFromLink } from "../../../native/deep-links";
import { channelPath, type Layer, packPath } from "../../../shell/layers";

const MOJI_BLUE_HOSTS = new Set(["moji.blue", "www.moji.blue"]);

export type PackSummary = { name?: string };

export type PackLinkTarget = { did: string; rkey: string };

export type LinkTargetContext = {
	space: string;
	threadChannel?: (thread: string) => string | undefined;
	pack?: (target: PackLinkTarget) => PackSummary | undefined;
};

type ChannelRecord = {
	space: string;
	channel: string;
	channelType: string;
	thread?: string;
	message?: string;
};

const decode = (part: string | undefined) => {
	if (part === undefined) return undefined;
	try {
		return decodeURIComponent(part);
	} catch {
		return undefined;
	}
};

const isDid = (value: string | undefined): value is string =>
	!!value && /^did:[a-z]+:[a-zA-Z0-9._:%-]+$/.test(value);

const isPackCollection = (collection: string | undefined) =>
	!!collection &&
	emojiRegistry.providers.some(
		(provider) => provider.collections.pack === collection,
	);

const mojiBluePack = (uri: string): PackLinkTarget | undefined => {
	let url: URL;
	try {
		url = new URL(uri);
	} catch {
		return undefined;
	}
	if (url.protocol !== "https:" || !MOJI_BLUE_HOSTS.has(url.hostname)) {
		return undefined;
	}
	const [head, did, rkey, ...rest] = url.pathname.split("/").filter(Boolean);
	const decodedDid = decode(did);
	const decodedRkey = decode(rkey);
	if (head !== "packs" || rest.length > 0) return undefined;
	if (!isDid(decodedDid) || !decodedRkey) return undefined;
	return { did: decodedDid, rkey: decodedRkey };
};

const atUriPack = (uri: string): PackLinkTarget | undefined => {
	if (!isAtUri(uri)) return undefined;
	const [did, collection, rkey, ...rest] = uri.slice(5).split("/");
	if (!isDid(did) || !isPackCollection(collection) || !rkey) return undefined;
	return rest.length === 0 ? { did, rkey } : undefined;
};

const routePack = (uri: string): PackLinkTarget | undefined => {
	const layer = routeFromLink(uri)?.layers.find(
		(entry) => entry.kind === "pack",
	);
	return layer?.kind === "pack"
		? { did: layer.did, rkey: layer.rkey }
		: undefined;
};

export const packLinkTarget = (uri: string): PackLinkTarget | undefined =>
	parseEmojiPackShareUrl(uri) ??
	routePack(uri) ??
	mojiBluePack(uri) ??
	atUriPack(uri);

const messageOf = (layer: Layer | undefined) => {
	const value = (layer as { message?: unknown } | undefined)?.message;
	return typeof value === "string" && value.length > 0 ? value : undefined;
};

const routeRecord = (uri: string): ChannelRecord | undefined => {
	const route = routeFromLink(uri);
	const layer = route?.layers.findLast(
		(entry) => entry.kind === "chat" || entry.kind === "thread",
	);
	if (layer?.kind !== "chat" && layer?.kind !== "thread") return undefined;
	const record: ChannelRecord = {
		space: layer.space,
		channel: layer.channel,
		channelType: layer.channelType ?? "",
	};
	if (layer.kind === "thread") record.thread = layer.thread;
	const message = messageOf(layer);
	if (message) record.message = message;
	return record;
};

const spaceTypeOf = (ref: string) => {
	const parts = ref.split("/");
	return parts[parts.length - 2] ?? "";
};

const atUriRecord = (
	uri: string,
	context: LinkTargetContext,
): ChannelRecord | undefined => {
	if (!isAtUri(uri)) return undefined;
	const [authority, marker, type, skey, ...rest] = uri.slice(5).split("/");
	if (marker !== "space" || !isDid(authority) || !type || !skey) {
		return undefined;
	}
	const isMessage = rest.length === 3 && rest[1] === MESSAGE_COLLECTION;
	if (rest.length > 0 && !isMessage) return undefined;
	const space = `at://${authority}/space/${type}/${skey}`;
	const message = isMessage ? rest[2] : undefined;
	if (isChannelSpace(space)) {
		return { space: authority, channel: skey, channelType: type, message };
	}
	if (!isThreadSpace(space) || authority !== context.space) return undefined;
	const parent = context.threadChannel?.(space);
	if (!parent) return undefined;
	return {
		space: authority,
		channel: skeyOf(parent),
		channelType: spaceTypeOf(parent),
		thread: skey,
		message,
	};
};

export const recordPath = (record: ChannelRecord) => {
	const channel = channelPath({
		space: record.space,
		channel: record.channel,
		channelType: record.channelType || undefined,
	});
	const base = record.thread
		? `${channel}/t/${encodeURIComponent(record.thread)}`
		: channel;
	return record.message
		? `${base}/m/${encodeURIComponent(record.message)}`
		: base;
};

const recordTarget = (
	record: ChannelRecord,
	href: string,
	context: LinkTargetContext,
	channelChip: boolean,
): RichTextLinkTarget => {
	const foreign = record.space !== context.space;
	if (record.message) {
		const target: RichTextLinkTarget = {
			kind: "message",
			space: record.space,
			channel: record.channel,
			rkey: record.message,
			href,
		};
		if (record.thread) target.thread = record.thread;
		if (foreign) target.foreign = true;
		return target;
	}
	if (record.thread) {
		return {
			kind: "thread",
			channel: record.channel,
			thread: record.thread,
			href,
			...(foreign ? { space: record.space } : {}),
		};
	}
	if (!channelChip && !foreign) return { kind: "internal", href };
	return foreign
		? { kind: "channel", channel: record.channel, space: record.space }
		: { kind: "channel", channel: record.channel };
};

const packTarget = (
	pack: PackLinkTarget,
	context: LinkTargetContext,
): RichTextLinkTarget => {
	const summary = context.pack?.(pack);
	const target: RichTextLinkTarget = {
		kind: "pack",
		did: pack.did,
		rkey: pack.rkey,
		href: `${clientOrigin()}${packPath(pack)}`,
	};
	if (summary?.name) target.name = summary.name;
	return target;
};

export const linkTargetFor = (
	uri: string,
	context: LinkTargetContext,
): RichTextLinkTarget | undefined => {
	const pack = packLinkTarget(uri);
	if (pack) return packTarget(pack, context);
	if (isAtUri(uri)) {
		const record = atUriRecord(uri, context);
		if (record) {
			return recordTarget(
				record,
				`${clientOrigin()}${recordPath(record)}`,
				context,
				true,
			);
		}
		const href = pdslsHrefFor(uri);
		return href ? { kind: "external", href } : undefined;
	}
	const record = routeRecord(uri);
	if (!record) {
		return routeFromLink(uri) ? { kind: "internal", href: uri } : undefined;
	}
	const target = recordTarget(record, uri, context, false);
	if (target.kind !== "thread") return target;
	return target.space
		? { ...target, href: uri }
		: { kind: "thread", channel: target.channel, thread: target.thread };
};
