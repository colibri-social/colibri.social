import { isThreadSpace } from "@colibri-social/lib";
import type { ForwardSource } from "@colibri-social/ui";
import { skeyOf, spaceKey } from "../ids";
import type { ChannelView, CommunityView, ForwardView } from "../types";

export type ForwardTarget = {
	space: string;
	channel: string;
	channelType: string;
	thread?: string;
};

export type ForwardDisplay = {
	createdAt: string;
	source?: ForwardSource;
	target?: ForwardTarget;
};

export type ForwardContext = {
	currentCommunity?: string;
	channelBySpace: (space: string) => ChannelView | undefined;
	threadNameBySpace?: (space: string) => string | undefined;
	threadChannelBySpace?: (space: string) => string | undefined;
	communities: ReadonlyMap<string, CommunityView>;
};

const spaceTypeOf = (space: string) => {
	const parts = space.split("/");
	return parts[parts.length - 2] ?? "";
};

const authorityOf = (space: string) =>
	space.slice("at://".length, space.indexOf("/space/"));

const targetOf = (
	space: string,
	local: boolean,
	community: CommunityView | undefined,
	context: ForwardContext,
): ForwardTarget | undefined => {
	if (!community) return undefined;
	const key = spaceKey(community);
	if (local) {
		const parent = context.threadChannelBySpace?.(space);
		if (parent) {
			return {
				space: key,
				channel: skeyOf(parent),
				channelType: spaceTypeOf(parent),
				thread: skeyOf(space),
			};
		}
	}
	if (isThreadSpace(space)) return undefined;
	return {
		space: key,
		channel: skeyOf(space),
		channelType: spaceTypeOf(space),
	};
};

export const toForwardDisplay = (
	forward: ForwardView,
	context: ForwardContext,
): ForwardDisplay => {
	const space = forward.source.space;
	const community = forward.sourceCommunity ?? authorityOf(space);
	const local = community === context.currentCommunity;
	const channel =
		forward.sourceName ??
		context.threadNameBySpace?.(space) ??
		(local ? context.channelBySpace(space)?.name : undefined);
	if (!channel) return { createdAt: forward.createdAt };
	const foreign = local ? undefined : context.communities.get(community);
	return {
		createdAt: forward.createdAt,
		source: {
			channel,
			space: foreign?.name,
			spaceIconSrc: foreign?.picture,
		},
		target: targetOf(space, local, context.communities.get(community), context),
	};
};
