import type { CustomEmoji } from "@colibri-social/ui";
import type { EmojiView } from "../emoji/model";
import type { Status } from "../types";

export type StatusCustomEmojiRef = { uri: string; cid?: string };

export type StatusEmojiLookup = {
	lookup: (uri: string) => EmojiView | undefined;
};

export type UiStatus = {
	text?: string;
	emoji?: string;
	customEmoji?: CustomEmoji;
	showWhileOffline?: boolean;
};

export const statusCustomEmojiRef = (
	status: Status | undefined,
): StatusCustomEmojiRef | undefined => {
	const ref = status?.customEmoji;
	if (!ref?.uri.startsWith("at://")) return undefined;
	return ref.cid ? { uri: ref.uri, cid: ref.cid } : { uri: ref.uri };
};

export const customEmojiOf = (
	emoji: EmojiView | undefined,
): CustomEmoji | undefined =>
	emoji ? { id: emoji.id, name: emoji.name, src: emoji.image } : undefined;

export const uiStatus = (
	status: Status | undefined,
	emoji: StatusEmojiLookup | undefined,
): UiStatus | undefined => {
	if (!status) return undefined;
	const ref = statusCustomEmojiRef(status);
	const customEmoji =
		ref && emoji ? customEmojiOf(emoji.lookup(ref.uri)) : undefined;
	const text = status.text?.trim() || undefined;
	const unicode = status.emoji || undefined;
	if (!text && !unicode && !customEmoji) return undefined;
	return {
		text,
		emoji: unicode,
		customEmoji,
		showWhileOffline: status.showWhileOffline,
	};
};
