import { parseSpace } from "@colibri-social/lib";
import type { CategoryView, ChannelView } from "./types";

export const channelIdentity = (space: string) => {
	const parsed = parseSpace(space);
	return parsed ? `${parsed.authority}/${parsed.skey}` : space;
};

export const sameChannel = (a: string, b: string) =>
	a === b || channelIdentity(a) === channelIdentity(b);

export type ChannelLayout = {
	categories: CategoryView[] | undefined;
	channels: ChannelView[] | undefined;
};

const uniqueChannels = (channels: readonly ChannelView[]) => {
	const seen = new Set<string>();
	const unique: ChannelView[] = [];
	for (const channel of channels) {
		const id = channelIdentity(channel.space);
		if (seen.has(id)) continue;
		seen.add(id);
		unique.push(channel);
	}
	return unique;
};

const withCategory = (channel: ChannelView, category: string | undefined) => {
	if (channel.category === category) return channel;
	const next = { ...channel };
	if (category) next.category = category;
	else delete next.category;
	return next;
};

export const normalizeChannelLayout = (
	categories: readonly CategoryView[] | undefined,
	channels: readonly ChannelView[] | undefined,
): ChannelLayout => {
	if (!categories) {
		return {
			categories: undefined,
			channels: channels && uniqueChannels(channels),
		};
	}
	const placement = new Map<string, string>();
	for (const category of categories) {
		for (const entry of category.channels) {
			const id = channelIdentity(entry.space);
			if (!placement.has(id)) placement.set(id, category.rkey);
		}
	}
	const rkeys = new Set(categories.map((category) => category.rkey));
	const canonical = channels
		? uniqueChannels(channels).map((channel) => {
				const id = channelIdentity(channel.space);
				const declared =
					channel.category && rkeys.has(channel.category)
						? channel.category
						: undefined;
				return withCategory(channel, placement.get(id) ?? declared);
			})
		: undefined;
	const byId = new Map(
		(canonical ?? []).map((channel) => [
			channelIdentity(channel.space),
			channel,
		]),
	);
	const placed = new Set<string>();
	const grouped = categories.map((category) => {
		const list: ChannelView[] = [];
		const add = (channel: ChannelView) => {
			const id = channelIdentity(channel.space);
			if (placed.has(id)) return;
			placed.add(id);
			list.push(channel);
		};
		for (const entry of category.channels) {
			const id = channelIdentity(entry.space);
			if (placement.get(id) !== category.rkey) continue;
			const channel = canonical
				? byId.get(id)
				: withCategory(entry, category.rkey);
			if (channel) add(channel);
		}
		for (const channel of canonical ?? []) {
			if (channel.category === category.rkey) add(channel);
		}
		const unchanged =
			list.length === category.channels.length &&
			list.every((channel, index) => channel === category.channels[index]);
		return unchanged ? category : { ...category, channels: list };
	});
	return { categories: grouped, channels: canonical };
};
