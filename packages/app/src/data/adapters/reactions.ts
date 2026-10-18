import type { Reaction, ReactionGroup, Reactor } from "@colibri-social/ui";
import type { MemberView, ReactionView } from "../types";
import { bridgePlatformName, displayNameOf } from "./authors";

type Members = ReadonlyMap<string, MemberView>;

export type CustomReactionEmoji = { name: string; src: string };

export type ResolveReactionEmoji = (
	emoji: string,
) => CustomReactionEmoji | undefined;

const SHORTCODE = /^:([a-z0-9_]{2,32}):$/;

export const customReactionResolver =
	(
		lookup: ((name: string) => CustomReactionEmoji | undefined) | undefined,
	): ResolveReactionEmoji =>
	(emoji) => {
		const name = SHORTCODE.exec(emoji)?.[1];
		return name ? lookup?.(name) : undefined;
	};

const reactorDids = (reaction: ReactionView) =>
	(reaction.reactors ?? []).map((value) => String(value));

export const toReactions = (
	reactions: readonly ReactionView[] = [],
	members: Members,
): Reaction[] =>
	reactions
		.filter((reaction) => reaction.count > 0)
		.map((reaction) => ({
			emoji: reaction.emoji,
			count: reaction.count,
			mine: !!reaction.viewerReacted,
			reactors: [
				...reactorDids(reaction).map((did) => {
					const member = members.get(did);
					return displayNameOf(member?.actor, member);
				}),
				...(reaction.bridgedReactors ?? []).map((bridged) => bridged.name),
			],
		}));

export const toReactionGroups = (
	reactions: readonly ReactionView[] = [],
	members: Members,
	viewer: string,
	resolve?: ResolveReactionEmoji,
): ReactionGroup[] =>
	reactions
		.filter((reaction) => reaction.count > 0)
		.map((reaction) => {
			const local: Reactor[] = reactorDids(reaction).map((did) => {
				const member = members.get(did);
				return {
					id: did,
					name: displayNameOf(member?.actor, member),
					handle: member?.actor.handle,
					avatarSrc: member?.actor.avatar,
					mine: did === viewer,
				};
			});
			const bridged: Reactor[] = (reaction.bridgedReactors ?? []).map(
				(entry) => ({
					id: `${entry.registration}:${entry.remoteId}`,
					name: entry.name,
					via: bridgePlatformName(entry.platform),
				}),
			);
			const custom = resolve?.(reaction.emoji);
			return {
				emoji: reaction.emoji,
				src: custom?.src,
				name: custom?.name,
				count: reaction.count,
				reactors: [...local, ...bridged],
			};
		});

export const toggleReaction = (
	reactions: readonly ReactionView[],
	emoji: string,
	viewer: string,
	add: boolean,
): ReactionView[] => {
	const existing = reactions.find((reaction) => reaction.emoji === emoji);
	if (!existing) {
		if (!add) return [...reactions];
		return [
			...reactions,
			{
				emoji,
				count: 1,
				reactors: [viewer as ReactionView["reactors"][number]],
				viewerReacted: true,
			},
		];
	}
	if (!!existing.viewerReacted === add) return [...reactions];
	const reactors = add
		? [...existing.reactors, viewer as ReactionView["reactors"][number]]
		: existing.reactors.filter((did) => String(did) !== viewer);
	const count = Math.max(0, existing.count + (add ? 1 : -1));
	return reactions
		.map((reaction) =>
			reaction === existing
				? { ...reaction, count, reactors, viewerReacted: add }
				: reaction,
		)
		.filter((reaction) => reaction.count > 0);
};
