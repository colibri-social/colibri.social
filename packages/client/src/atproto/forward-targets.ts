import { SPACE_TYPES } from "./lexicons";

export type ForwardTargetChannel = {
	space: string;
	name: string;
	type: string;
	category?: string;
	viewer: { canPost: boolean };
};

export type ForwardTargetThread = {
	space: string;
	channel: string;
	name: string;
	viewer: { canPost: boolean };
};

export type ForwardTargetCommunity = {
	did: string;
	name: string;
	picture?: string;
};

export type ForwardTargetOption = {
	space: string;
	channelSpace: string;
	channelName: string;
	category?: string;
	thread?: string;
	community: ForwardTargetCommunity;
};

const categoryPrefixOf = (
	channel: ForwardTargetChannel,
	channels: ReadonlyArray<ForwardTargetChannel>,
	categories: ReadonlyArray<{ rkey: string; name: string }>,
): string | undefined => {
	if (channel.category === undefined) return undefined;
	const shared = channels.filter((entry) => entry.name === channel.name);
	if (shared.length < 2) return undefined;
	if (shared.every((entry) => entry.category === channel.category))
		return undefined;
	return categories.find((entry) => entry.rkey === channel.category)?.name;
};

export const compareForwardTargets = (
	a: ForwardTargetOption,
	b: ForwardTargetOption,
): number => {
	const byCommunity = a.community.name.localeCompare(b.community.name);
	if (byCommunity !== 0) return byCommunity;
	const byChannel = a.channelName.localeCompare(b.channelName);
	if (byChannel !== 0) return byChannel;
	return (a.thread ?? "").localeCompare(b.thread ?? "");
};

export const forwardTargets = (input: {
	community: ForwardTargetCommunity;
	channels: ReadonlyArray<ForwardTargetChannel>;
	categories?: ReadonlyArray<{ rkey: string; name: string }>;
	threads: ReadonlyArray<ForwardTargetThread>;
}): ForwardTargetOption[] => {
	const categories = input.categories ?? [];
	const postable = input.channels.filter(
		(channel) =>
			channel.type === SPACE_TYPES.channelText && channel.viewer.canPost,
	);

	const byChannel = new Map(
		postable.map((channel) => [channel.space, channel]),
	);

	const optionFor = (channel: ForwardTargetChannel): ForwardTargetOption => {
		const category = categoryPrefixOf(channel, postable, categories);
		return {
			space: channel.space,
			channelSpace: channel.space,
			channelName: channel.name,
			community: input.community,
			...(category ? { category } : {}),
		};
	};

	const options: ForwardTargetOption[] = postable.map(optionFor);

	for (const thread of input.threads) {
		if (!thread.viewer.canPost) continue;
		const parent = byChannel.get(thread.channel);
		if (!parent) continue;
		options.push({
			...optionFor(parent),
			space: thread.space,
			thread: thread.name,
		});
	}

	return options.sort(compareForwardTargets);
};

export const matchesForwardFilter = (
	option: ForwardTargetOption,
	query: string,
): boolean => {
	const needle = query.trim().toLowerCase();
	if (needle.length === 0) return true;
	const haystack = [
		option.channelName,
		option.thread,
		option.category,
		option.community.name,
	]
		.filter((part): part is string => part !== undefined)
		.join(" ")
		.toLowerCase();
	return haystack.includes(needle);
};

export const forwardTargetName = (option: ForwardTargetOption): string => {
	const channel = option.category
		? `${option.category} / ${option.channelName}`
		: option.channelName;
	return option.thread ? `${channel} / ${option.thread}` : channel;
};

export const forwardTargetLabel = (option: ForwardTargetOption): string =>
	`${forwardTargetName(option)} in ${option.community.name}`;
