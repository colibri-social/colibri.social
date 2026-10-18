import { displayNameOf } from "./adapters/authors";
import { summarizeMessage } from "./channel-summary";
import { skeyOf } from "./ids";
import type { DataStore } from "./store";
import type { Did, NotificationView } from "./types";

export type NotificationContent = {
	authorName: string;
	authorAvatar: string | undefined;
	authorSeed: string;
	location: string;
	spaceName: string | undefined;
	text: string;
	subtitle: string;
};

const kindLabel = (view: NotificationView): string | undefined => {
	if (view.kind === "reply") return "Replied to you";
	if (view.kind !== "mention") return undefined;
	return view.mentionRole ? `Mentioned @${view.mentionRole}` : "Mentioned you";
};

export const describeNotification = (
	data: Pick<DataStore, "spaceByKey" | "space" | "threadsOf">,
	view: NotificationView,
): NotificationContent => {
	const community = data.spaceByKey(view.community);
	const space = community ? data.space(community) : undefined;
	const channelName =
		space?.channelBySlug(skeyOf(view.channel))?.name ?? skeyOf(view.channel);
	const threadName = view.thread
		? (view.threadName ??
			data
				.threadsOf(view.channel)
				.value()
				?.find((thread) => thread.space === view.thread)?.name)
		: undefined;
	const location = view.thread
		? (threadName ?? `Thread in #${channelName}`)
		: `#${channelName}`;
	const place = community?.name ? `${community.name} › ${location}` : location;
	const label = kindLabel(view);
	return {
		authorName: displayNameOf(
			view.author,
			space?.memberByDid(view.author.did as Did),
		),
		authorAvatar: view.author.avatar,
		authorSeed: view.author.did,
		location,
		spaceName: community?.name,
		text:
			(view.message ? summarizeMessage(view.message).text : "") ||
			"Sent a message",
		subtitle: label ? `${label} · ${place}` : place,
	};
};
