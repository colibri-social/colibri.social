import { channelSlug } from "../data/ids";
import type { ControlsPreferences } from "../data/source";
import type { DataStore } from "../data/store";
import type { ChatLayer, Layer, MembersLayer, Root } from "./layers";
import { lastViewedChannel, topmostTextChannel } from "./text-channel";

export type ForwardData = Pick<
	DataStore,
	"spaceByKey" | "space" | "lastChannel"
>;

export const membersForward = (
	top: Layer | undefined,
): MembersLayer | undefined => {
	if (top?.kind !== "chat" && top?.kind !== "thread") return undefined;
	const members: MembersLayer = {
		kind: "members",
		space: top.space,
		channel: top.channel,
	};
	if (top.kind === "thread") members.thread = top.thread;
	return members;
};

const channelForward = (
	top: Layer | undefined,
	root: Root,
	data: ForwardData,
): ChatLayer | undefined => {
	if (top || root.tab !== "spaces" || !root.space) return undefined;
	const community = data.spaceByKey(root.space);
	if (!community) return undefined;
	const space = data.space(community);
	const channels = space.channels.value();
	if (!channels) return undefined;
	const target =
		lastViewedChannel(data, community, channels) ??
		topmostTextChannel(channels, space.categories.value());
	if (!target) return undefined;

	return {
		kind: "chat",
		space: root.space,
		channel: channelSlug(target),
		channelType: target.type,
	};
};

export const swipeForward = (data: ForwardData) => {
	return (top: Layer | undefined, root: Root) =>
		membersForward(top) ?? channelForward(top, root, data);
};

export const canSwipeForward = (
	top: Layer | undefined,
	state: {
		selecting: boolean;
		swipeLeftAction: ControlsPreferences["swipeLeftAction"];
	},
) =>
	!state.selecting &&
	(!membersForward(top) || state.swipeLeftAction !== "reply");
