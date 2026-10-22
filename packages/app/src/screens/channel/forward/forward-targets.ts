import { channelSlug, isVoiceChannel } from "../../../data/ids";
import type {
	CategoryView,
	ChannelView,
	CommunityView,
	SpaceRef,
	ThreadView,
} from "../../../data/types";

export type ForwardTarget = {
	key: SpaceRef;
	space: CommunityView;
	channel: ChannelView;
	thread?: ThreadView;
	skey: string;
	category?: string;
	current: boolean;
};

export type ForwardThreadList = {
	value?: readonly ThreadView[];
	loading?: boolean;
	failed?: boolean;
};

export type ForwardChannelGroup = {
	target: ForwardTarget;
	threads: ForwardTarget[];
	loaded: boolean;
	loading: boolean;
	failed: boolean;
	threadMatch: boolean;
};

export type ForwardGroup = {
	space: CommunityView;
	channels: ForwardChannelGroup[];
};

export type ForwardSpaceInput = {
	space: CommunityView;
	channels: readonly ChannelView[];
	categories?: readonly CategoryView[];
	threads?: (channel: ChannelView) => ForwardThreadList | undefined;
};

export const isForwardable = (channel: ChannelView) =>
	!isVoiceChannel(channel) &&
	channel.viewer.canRead !== false &&
	channel.viewer.canPost !== false;

export const isForwardableThread = (thread: ThreadView) =>
	!thread.closedAt && !!thread.viewer.canPost;

const byActivity = (a: ThreadView, b: ThreadView) =>
	a.lastActivityAt === b.lastActivityAt
		? a.name.localeCompare(b.name)
		: a.lastActivityAt < b.lastActivityAt
			? 1
			: -1;

export const forwardGroups = (
	spaces: readonly ForwardSpaceInput[],
	current?: SpaceRef,
): ForwardGroup[] =>
	spaces
		.map(({ space, channels, categories, threads }) => {
			const categoryName = new Map(
				(categories ?? []).map((category) => [category.rkey, category.name]),
			);
			return {
				space,
				channels: channels.filter(isForwardable).map((channel) => {
					const target: ForwardTarget = {
						key: channel.space,
						space,
						channel,
						skey: channelSlug(channel),
						category: channel.category
							? categoryName.get(channel.category)
							: undefined,
						current: channel.space === current,
					};
					const list = threads?.(channel);
					return {
						target,
						threads: (list?.value ?? [])
							.filter(isForwardableThread)
							.slice()
							.sort(byActivity)
							.map((thread) => ({
								...target,
								key: thread.space,
								thread,
								current: thread.space === current,
							})),
						loaded: !!list?.value,
						loading: !!list?.loading && !list.value,
						failed: !!list?.failed,
						threadMatch: false,
					};
				}),
			};
		})
		.filter((group) => group.channels.length > 0);

const fold = (value: string) =>
	value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();

const needleOf = (query: string) => fold(query.trim().replace(/^#/, ""));

export const matchesForwardFilter = (target: ForwardTarget, query: string) => {
	const needle = needleOf(query);
	if (!needle) return true;
	const names = target.thread
		? [target.thread.name]
		: [target.channel.name, target.category ?? "", target.space.name];
	return names.some((value) => fold(value).includes(needle));
};

export const filterForwardGroups = (
	groups: readonly ForwardGroup[],
	query: string,
): ForwardGroup[] => {
	if (!needleOf(query)) return groups.slice();
	return groups
		.map((group) => ({
			space: group.space,
			channels: group.channels.flatMap((entry) => {
				const named = matchesForwardFilter(entry.target, query);
				const hits = entry.threads.filter((thread) =>
					matchesForwardFilter(thread, query),
				);
				if (!named && hits.length === 0) return [];
				return [
					{
						...entry,
						threads: hits.length > 0 ? hits : entry.threads,
						threadMatch: hits.length > 0,
					},
				];
			}),
		}))
		.filter((group) => group.channels.length > 0);
};

export const forwardTargetName = (target: ForwardTarget) =>
	target.thread ? target.thread.name : `#${target.channel.name}`;

export const forwardDestinationNoun = (
	targets: readonly ForwardTarget[],
	count = targets.length,
) => {
	const threads = targets.filter((target) => target.thread).length;
	const kind =
		threads === 0 ? "channel" : threads === targets.length ? "thread" : "place";
	return `${count} ${count === 1 ? kind : `${kind}s`}`;
};

const channelListFormat = new Intl.ListFormat("en", {
	style: "long",
	type: "conjunction",
});

export const forwardChannelList = (
	targets: readonly ForwardTarget[],
	limit = 3,
) => {
	const names = targets.map(forwardTargetName);
	if (names.length <= limit) return channelListFormat.format(names);
	const rest = names.length - (limit - 1);
	return channelListFormat.format([
		...names.slice(0, limit - 1),
		`${rest} more`,
	]);
};
