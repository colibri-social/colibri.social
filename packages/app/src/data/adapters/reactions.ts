import {
	aliasesForSlug,
	type Reaction,
	type ReactionGroup,
	type Reactor,
	slugForEmoji,
	stripSkinTone,
} from "@colibri-social/ui";
import type { MemberView, ReactionEmojiRef, ReactionView } from "../types";
import { bridgePlatformName, displayNameOf } from "./authors";

type Members = ReadonlyMap<string, MemberView>;

export type CustomReactionEmoji = { id?: string; name: string; src: string };

export type ReactionEmoji = {
	emoji: string;
	customEmoji?: ReactionEmojiRef;
};

export type ResolveReactionEmoji = (
	reaction: ReactionEmoji,
) => CustomReactionEmoji | undefined;

const SHORTCODE = /^:([a-z0-9_]{2,32}):$/;

export const reactionShortcode = (emoji: string) => SHORTCODE.exec(emoji)?.[1];

export const customReactionResolver =
	(
		byName: ((name: string) => CustomReactionEmoji | undefined) | undefined,
		byUri?: (uri: string) => CustomReactionEmoji | undefined,
	): ResolveReactionEmoji =>
	(reaction) => {
		const name = reactionShortcode(reaction.emoji);
		if (!name) return undefined;
		const uri = reaction.customEmoji?.uri;
		return uri ? byUri?.(uri) : byName?.(name);
	};

const unicodeName = (emoji: string) => {
	const slug = slugForEmoji(emoji) ?? slugForEmoji(stripSkinTone(emoji));
	return slug ? (aliasesForSlug(slug)[0] ?? slug) : undefined;
};

export const reactionName = (
	reaction: ReactionEmoji,
	resolve?: ResolveReactionEmoji,
) =>
	resolve?.(reaction)?.name ??
	reactionShortcode(reaction.emoji) ??
	unicodeName(reaction.emoji);

export const reactionFor = (
	reactions: readonly ReactionView[] | undefined,
	emoji: string,
): ReactionView | undefined =>
	reactions?.find((reaction) => reaction.emoji === emoji);

const reactorDids = (reaction: ReactionView) =>
	(reaction.reactors ?? []).map((value) => String(value));

export const toReactions = (
	reactions: readonly ReactionView[] = [],
	members: Members,
	resolve?: ResolveReactionEmoji,
): Reaction[] =>
	reactions
		.filter((reaction) => reaction.count > 0)
		.map((reaction) => ({
			emoji: reaction.emoji,
			label: reactionName(reaction, resolve),
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
	unavailable?: (reaction: ReactionEmoji) => boolean,
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
			const custom = resolve?.(reaction);
			return {
				emoji: reaction.emoji,
				src: custom?.src,
				name: custom?.name,
				custom: reactionShortcode(reaction.emoji) !== undefined || undefined,
				unavailable: (!custom && unavailable?.(reaction)) || undefined,
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
