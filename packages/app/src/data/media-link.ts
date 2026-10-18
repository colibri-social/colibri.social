import { classifyThrown, createLogger } from "@colibri-social/lib";
import { createContext, untrack } from "solid-js";
import type { ListMessagesParams, MessagePage } from "./source";
import type { ChannelData } from "./store";
import type { MessageView } from "./types";

const log = createLogger("media-link");

export const MEDIA_REFRESH_PAGE_SIZE = 20;

const SIGNATURE_PARAMS = ["exp", "sig"];

export const mediaLinkTarget = (url: string): string => {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return url;
	}
	for (const param of SIGNATURE_PARAMS) parsed.searchParams.delete(param);
	return parsed.toString();
};

const mediaLinksOf = (message: MessageView) => [
	...(message.attachments ?? []),
	...(message.forward?.attachments ?? []),
];

const linkFor = (message: MessageView, target: string) =>
	mediaLinksOf(message).find(
		(attachment) => mediaLinkTarget(attachment.url) === target,
	)?.url;

export const findMediaHolder = (
	messages: readonly MessageView[],
	url: string,
): MessageView | undefined => {
	const target = mediaLinkTarget(url);
	return messages.find((message) => linkFor(message, target) !== undefined);
};

export type MediaLinkFeed = Pick<
	ChannelData,
	"channel" | "messages" | "attach"
>;

export type MediaLinkRefresher = {
	refresh: (url: string) => Promise<boolean>;
	retry: (url: string) => void;
};

export const createMediaLinkRefresher = (options: {
	feed: () => MediaLinkFeed | undefined;
	listMessages: (params: ListMessagesParams) => Promise<MessagePage>;
}): MediaLinkRefresher => {
	const tried = new Set<string>();
	const inflight = new Map<string, Promise<void>>();

	const reload = (feed: MediaLinkFeed, rkey: string) => {
		const key = `${feed.channel} ${rkey}`;
		const running = inflight.get(key);
		if (running) return running;
		const work = options
			.listMessages({
				channel: feed.channel,
				around: rkey,
				limit: MEDIA_REFRESH_PAGE_SIZE,
			})
			.then((page) => {
				const held = new Set(untrack(feed.messages).map((entry) => entry.rkey));
				const fresh = page.items.filter((entry) => held.has(entry.rkey));
				if (fresh.length > 0) feed.attach(fresh);
			})
			.catch((error: unknown) => {
				log.warn("media link refresh failed", {
					code: classifyThrown(error, { method: "channel.listMessages" }).code,
				});
			})
			.finally(() => inflight.delete(key));
		inflight.set(key, work);
		return work;
	};

	return {
		refresh: async (url) => {
			const feed = options.feed();
			if (!feed) return false;
			const target = mediaLinkTarget(url);
			if (tried.has(target)) return false;
			const holder = findMediaHolder(untrack(feed.messages), url);
			if (!holder) return false;
			tried.add(target);
			await reload(feed, holder.rkey);
			const updated = untrack(feed.messages).find(
				(message) => message.rkey === holder.rkey,
			);
			const next = updated ? linkFor(updated, target) : undefined;
			return next !== undefined && next !== url;
		},
		retry: (url) => {
			tried.delete(mediaLinkTarget(url));
		},
	};
};

export const MediaLinkContext = createContext<MediaLinkRefresher>();
