import { channelSlug, isVoiceChannel, spaceKey } from "../data/ids";
import type { DataStore } from "../data/store";
import type { CategoryView, ChannelView, CommunityView } from "../data/types";

export const lastViewedChannel = (
	data: Pick<DataStore, "lastChannel">,
	community: CommunityView,
	channels: readonly ChannelView[],
) => {
	const slug = data.lastChannel(spaceKey(community));
	if (!slug) return undefined;
	const target = channels.find((channel) => channelSlug(channel) === slug);
	return target && !isVoiceChannel(target) ? target : undefined;
};

export const topmostTextChannel = (
	channels: readonly ChannelView[],
	categories: readonly CategoryView[] | undefined,
) => {
	const listed = categories
		? [
				...channels.filter((channel) => !channel.category),
				...categories.flatMap((category) => category.channels),
			]
		: channels;

	return listed.find((channel) => !isVoiceChannel(channel));
};
