import { channelSlug, isVoiceChannel } from "../../../data/ids";
import type {
	CategoryView,
	ChannelView,
	CommunityView,
	SpaceRef,
} from "../../../data/types";

export type ForwardTarget = {
	key: string;
	space: CommunityView;
	channel: ChannelView;
	skey: string;
	category?: string;
	current: boolean;
};

export type ForwardGroup = {
	space: CommunityView;
	targets: ForwardTarget[];
};

export type ForwardSpaceInput = {
	space: CommunityView;
	channels: readonly ChannelView[];
	categories?: readonly CategoryView[];
};

export const isForwardable = (channel: ChannelView) =>
	!isVoiceChannel(channel) &&
	channel.viewer.canRead !== false &&
	channel.viewer.canPost !== false;

export const forwardGroups = (
	spaces: readonly ForwardSpaceInput[],
	current?: SpaceRef,
): ForwardGroup[] =>
	spaces
		.map(({ space, channels, categories }) => {
			const categoryName = new Map(
				(categories ?? []).map((category) => [category.rkey, category.name]),
			);
			return {
				space,
				targets: channels.filter(isForwardable).map((channel) => ({
					key: channel.space,
					space,
					channel,
					skey: channelSlug(channel),
					category: channel.category
						? categoryName.get(channel.category)
						: undefined,
					current: channel.space === current,
				})),
			};
		})
		.filter((group) => group.targets.length > 0);

const fold = (value: string) =>
	value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();

export const matchesForwardFilter = (target: ForwardTarget, query: string) => {
	const needle = fold(query.trim().replace(/^#/, ""));
	if (!needle) return true;
	return [target.channel.name, target.category ?? "", target.space.name].some(
		(value) => fold(value).includes(needle),
	);
};

export const filterForwardGroups = (
	groups: readonly ForwardGroup[],
	query: string,
): ForwardGroup[] =>
	groups
		.map((group) => ({
			space: group.space,
			targets: group.targets.filter((target) =>
				matchesForwardFilter(target, query),
			),
		}))
		.filter((group) => group.targets.length > 0);
