import type {
	ChannelSuggestion,
	CustomEmojiSuggestion,
	EmojiPack,
	MemberSuggestion,
	RichEditorSources,
	RoleSuggestion,
} from "@colibri-social/ui";
import { displayNameOf } from "../../../data/adapters/display-name";
import { uiPresence } from "../../../data/adapters/presence";
import {
	canReadChannel,
	isAdminRoleSet,
} from "../../../data/category-permissions";
import { channelSlug, isVoiceChannel } from "../../../data/ids";
import { isMentionableRole } from "../../../data/role-flags";
import type { DataStore } from "../../../data/store";
import type {
	CategoryView,
	ChannelView,
	CommunityView,
	Did,
	Facet,
	MemberView,
	RoleView,
} from "../../../data/types";
import { type ForwardTarget, forwardTargetName } from "./forward-targets";

export type NoteSpace = {
	community: CommunityView;
	members?: readonly MemberView[];
	roles?: readonly RoleView[];
	channels?: readonly ChannelView[];
	categories?: readonly CategoryView[];
};

export type NoteProblem = { kind: "member" | "role" | "channel"; hint: string };

const REMOVE_HINT = "Remove the mention to forward this.";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const labelOf = (text: string, facet: Facet) =>
	decoder.decode(
		encoder.encode(text).slice(facet.index.byteStart, facet.index.byteEnd),
	);

export const spacesOf = (targets: readonly ForwardTarget[]) => {
	const seen = new Map<string, CommunityView>();
	for (const target of targets) seen.set(target.space.did, target.space);
	return [...seen.values()];
};

export const singleSpaceOf = (targets: readonly ForwardTarget[]) => {
	const spaces = spacesOf(targets);
	return spaces.length === 1 ? spaces[0] : undefined;
};

export const readersOf = (target: ForwardTarget, space: NoteSpace) => {
	if (!space.members) return undefined;
	const roles = space.roles ?? [];
	const category = target.channel.category
		? space.categories?.find((entry) => entry.rkey === target.channel.category)
		: undefined;
	return new Map(
		space.members
			.filter((member) =>
				canReadChannel(target.channel, category, {
					did: member.actor.did,
					roles: member.roles ?? [],
					admin: isAdminRoleSet(member.roles ?? [], roles),
				}),
			)
			.map((member) => [member.actor.did as string, member]),
	);
};

export const mentionableMembers = (
	targets: readonly ForwardTarget[],
	spaceOf: (target: ForwardTarget) => NoteSpace,
): MemberView[] => {
	const [first, ...rest] = targets;
	if (!first) return [];
	const base = readersOf(first, spaceOf(first));
	if (!base) return [];
	const others = rest.map((target) => readersOf(target, spaceOf(target)));
	if (others.some((readers) => !readers)) return [];
	return [...base.values()].filter((member) =>
		others.every((readers) => readers?.has(member.actor.did)),
	);
};

const featureOf = (facet: Facet) => {
	for (const feature of facet.features) {
		const kind = (feature as { $type?: string }).$type;
		if (kind === "social.colibri.beta.richtext.facet#mention")
			return { kind: "member" as const, id: (feature as { did: string }).did };
		if (kind === "social.colibri.beta.richtext.facet#role")
			return { kind: "role" as const, id: (feature as { role: string }).role };
		if (kind === "social.colibri.beta.richtext.facet#channel")
			return {
				kind: "channel" as const,
				id: (feature as { channel: string }).channel,
			};
	}
	return undefined;
};

const memberProblem = (
	label: string,
	did: string,
	targets: readonly ForwardTarget[],
	spaceOf: (target: ForwardTarget) => NoteSpace,
) => {
	for (const target of targets) {
		const space = spaceOf(target);
		const readers = readersOf(target, space);
		if (!readers || readers.has(did)) continue;
		const member = space.members?.some((entry) => entry.actor.did === did);
		return member
			? `${label} can't see ${forwardTargetName(target)}. ${REMOVE_HINT}`
			: `${label} isn't in ${target.space.name}. ${REMOVE_HINT}`;
	}
	return undefined;
};

const spaceWideProblem = (
	kind: "role" | "channel",
	label: string,
	id: string,
	targets: readonly ForwardTarget[],
	spaceOf: (target: ForwardTarget) => NoteSpace,
) => {
	const only = singleSpaceOf(targets);
	const [first] = targets;
	if (!only || !first)
		return `${label} only works when you forward to one Space. ${REMOVE_HINT}`;
	const space = spaceOf(first);
	if (kind === "role") {
		if (!space.roles) return undefined;
		const role = space.roles.find((entry) => entry.rkey === id);
		return role && isMentionableRole(role)
			? undefined
			: `${label} isn't a role in ${only.name}. ${REMOVE_HINT}`;
	}
	if (!space.channels) return undefined;
	const channel = space.channels.find((entry) => channelSlug(entry) === id);
	return channel && channel.viewer.canRead !== false
		? undefined
		: `${label} isn't in ${only.name}. ${REMOVE_HINT}`;
};

export const noteProblem = (
	value: { text: string; facets: readonly Facet[] },
	targets: readonly ForwardTarget[],
	spaceOf: (target: ForwardTarget) => NoteSpace,
): NoteProblem | undefined => {
	if (targets.length === 0) return undefined;
	for (const facet of value.facets) {
		const feature = featureOf(facet);
		if (!feature) continue;
		const label = labelOf(value.text, facet);
		const hint =
			feature.kind === "member"
				? memberProblem(label, feature.id, targets, spaceOf)
				: spaceWideProblem(feature.kind, label, feature.id, targets, spaceOf);
		if (hint) return { kind: feature.kind, hint };
	}
	return undefined;
};

const memberSuggestion = (
	data: DataStore,
	member: MemberView,
): MemberSuggestion => ({
	did: member.actor.did,
	name: displayNameOf(member.actor, member),
	handle: member.actor.handle,
	avatarSrc: member.actor.avatar,
	presence: uiPresence(data.presenceOf(member.actor.did as Did)),
});

export const noteSpaceOf =
	(data: DataStore) =>
	(target: ForwardTarget): NoteSpace => {
		const loaded = data.space(target.space);
		return {
			community: target.space,
			members: loaded.members.value(),
			roles: loaded.roles.value(),
			channels: loaded.channels.value(),
			categories: loaded.categories.value(),
		};
	};

export const createNoteSources = (
	data: DataStore,
	context: () => readonly ForwardTarget[],
	fallbackSpace: () => string | undefined,
): { sources: RichEditorSources; packs: () => EmojiPack[] } => {
	const spaceOf = noteSpaceOf(data);
	const emojiSpaces = () => {
		const spaces = spacesOf(context()).map((space) => space.did);
		const fallback = fallbackSpace();
		return spaces.length > 0 ? spaces : fallback ? [fallback] : [];
	};
	const usable = (uri: string) =>
		emojiSpaces().every((space) => data.emoji.allows(space as Did, uri));
	const primary = () => emojiSpaces()[0] as Did | undefined;
	const members = () => mentionableMembers(context(), spaceOf);
	const only = () => {
		const [first] = context();
		return first && singleSpaceOf(context()) ? spaceOf(first) : undefined;
	};
	const usableSuggestion = (emoji: CustomEmojiSuggestion | undefined) =>
		emoji && usable(emoji.id) ? emoji : undefined;

	const sources: RichEditorSources = {
		searchCustomEmoji: (query, limit) =>
			data.emoji
				.search(primary(), query, Number.MAX_SAFE_INTEGER)
				.filter((emoji) => usable(emoji.id))
				.slice(0, limit),
		customEmojiByName: (name) => {
			const current = primary();
			const emoji = current ? data.emoji.find(current, name) : undefined;
			return usableSuggestion(emoji && data.emoji.suggestion(emoji));
		},
		resolveCustomEmoji: ({ uri }) => {
			const emoji = data.emoji.resolve(primary(), uri);
			return usableSuggestion(emoji && data.emoji.suggestion(emoji));
		},
		searchMembers: (query, limit) => {
			const needle = query.toLowerCase();
			const results: MemberSuggestion[] = [];
			for (const member of members()) {
				const name = displayNameOf(member.actor, member);
				if (
					name.toLowerCase().includes(needle) ||
					member.actor.handle.includes(needle)
				) {
					results.push(memberSuggestion(data, member));
					if (results.length >= limit) break;
				}
			}
			return results;
		},
		resolveMember: (did) => {
			for (const target of context()) {
				const member = spaceOf(target).members?.find(
					(entry) => entry.actor.did === did,
				);
				if (member) return memberSuggestion(data, member);
			}
			return undefined;
		},
		roles: (): RoleSuggestion[] =>
			(only()?.roles ?? [])
				.filter(isMentionableRole)
				.map((role) => ({ id: role.rkey, name: role.name, color: role.color })),
		channels: (): ChannelSuggestion[] =>
			(only()?.channels ?? [])
				.filter((entry) => entry.viewer.canRead !== false)
				.map((entry) => ({
					id: channelSlug(entry),
					name: entry.name,
					kind: isVoiceChannel(entry) ? "voice" : "text",
				})),
		resolveChannel: (id) => {
			const entry = only()?.channels?.find(
				(channel) => channelSlug(channel) === id,
			);
			return entry ? { label: entry.name } : undefined;
		},
		timeShortcut: true,
	};

	const packs = () =>
		data.emoji
			.packs(primary())
			.map((pack) => ({
				...pack,
				emojis: pack.emojis.filter((emoji) => usable(emoji.id)),
			}))
			.filter((pack) => pack.emojis.length > 0);

	return { sources, packs };
};
