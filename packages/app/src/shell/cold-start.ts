import { createEffect, untrack } from "solid-js";
import { channelSlug, isVoiceChannel, spaceKey } from "../data/ids";
import type { DataStore } from "../data/store";
import type { ChannelView, CommunityView } from "../data/types";
import type { Navigator } from "./stack";

export const lastViewedSpace = (
	data: DataStore,
	list: readonly CommunityView[],
) => {
	const key = data.lastSpace();
	return key ? list.find((entry) => spaceKey(entry) === key) : undefined;
};

export const lastViewedChannel = (
	data: DataStore,
	community: CommunityView,
	channels: readonly ChannelView[],
) => {
	const slug = data.lastChannel(spaceKey(community));
	if (!slug) return undefined;
	const target = channels.find((channel) => channelSlug(channel) === slug);
	return target && !isVoiceChannel(target) ? target : undefined;
};

const atColdStart = (stack: Navigator, space?: string) => {
	const root = stack.root();
	return root.tab === "spaces" && root.space === space && stack.depth() === 0;
};

export const restoreLastViewed = (data: DataStore, stack: Navigator) => {
	if (!untrack(() => atColdStart(stack))) return;
	let pending = true;
	createEffect(() => {
		if (!pending) return;
		if (data.communities.error()) {
			pending = false;
			return;
		}
		const list = data.communities.value();
		if (!list) return;
		const community = lastViewedSpace(data, list);
		if (!community) {
			pending = false;
			return;
		}
		const key = spaceKey(community);
		const moved = untrack(() => {
			if (atColdStart(stack)) {
				stack.setRoot({ tab: "spaces", space: key });
				return false;
			}
			return !atColdStart(stack, key);
		});
		if (moved) {
			pending = false;
			return;
		}
		const space = data.space(community);
		if (space.channels.error()) {
			pending = false;
			return;
		}
		const channels = space.channels.value();
		if (!channels) return;
		pending = false;
		const target = lastViewedChannel(data, community, channels);
		if (!target) return;
		untrack(() => {
			if (!atColdStart(stack, key)) return;
			stack.push({
				kind: "chat",
				space: key,
				channel: channelSlug(target),
				channelType: target.type,
			});
		});
	});
};
