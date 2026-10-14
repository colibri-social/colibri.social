import type { AudienceRole, MemberIdentityData } from "@colibri-social/ui";
import { createMemo } from "solid-js";
import { rankOf } from "../../../data/member-permissions";
import { roleIdentity } from "../../../data/roles";
import type { SpaceData } from "../../../data/store";
import { useData } from "../../../data/store";
import type { CommunityView, Did } from "../../../data/types";
import { uiPresence } from "../../members/member-adapter";

export type Audience = { roles: string[]; members: string[] };

export type AudienceKind = "visible" | "post";

export const AUDIENCE_COPY: Record<
	AudienceKind,
	{ title: string; empty: string }
> = {
	visible: {
		title: "Who can see it",
		empty:
			"No roles or members specified. Every member will be able to see this channel!",
	},
	post: {
		title: "Who can post in it",
		empty:
			"No roles or members specified. Everyone will be allowed to chat here!",
	},
};

export const sameSet = (a: readonly string[], b: readonly string[]) =>
	a.length === b.length && a.every((entry) => b.includes(entry));

export const sameAudience = (a: Audience, b: Audience) =>
	sameSet(a.roles, b.roles) && sameSet(a.members, b.members);

const plural = (count: number, noun: string) =>
	`${count} ${noun}${count === 1 ? "" : "s"}`;

export const audienceSummary = (audience: Audience) => {
	const parts = [
		audience.roles.length ? plural(audience.roles.length, "role") : "",
		audience.members.length ? plural(audience.members.length, "member") : "",
	].filter(Boolean);
	return parts.length ? parts.join(", ") : "Everyone";
};

export const createAudienceOptions = (
	community: () => CommunityView | undefined,
	space: () => SpaceData | undefined,
) => {
	const data = useData();
	const roles = createMemo(() =>
		[...(space()?.roles.value() ?? [])].sort((a, b) => b.position - a.position),
	);
	const isOwner = () => !!community()?.viewer.isOwner;
	const rank = createMemo(() =>
		rankOf(community()?.viewer.roles ?? [], roles(), isOwner()),
	);
	const roleOptions = createMemo((): AudienceRole[] =>
		roles().map((role) => ({ ...roleIdentity(role), id: role.rkey })),
	);
	const memberOptions = createMemo((): MemberIdentityData[] =>
		(space()?.members.value() ?? []).map((member) => {
			const colored = roles().find(
				(role) => member.roles.includes(role.rkey) && !!role.color,
			);
			return {
				id: member.actor.did,
				name:
					member.nickname ?? member.actor.displayName ?? member.actor.handle,
				handle: member.actor.handle,
				avatarSrc: member.actor.avatar,
				presence: uiPresence(data.presenceOf(member.actor.did)),
				role: colored ? roleIdentity(colored) : undefined,
				bot: member.actor.isBot,
			};
		}),
	);
	const canSelectRole = (rkey: string) => {
		if (isOwner()) return true;
		const role = roles().find((entry) => entry.rkey === rkey);
		return !!role && !role.protected && role.position < rank();
	};
	const canSelectMember = (did: string) => {
		if (isOwner()) return true;
		if (did === data.viewer.did) return false;
		const member = space()?.memberByDid(did as Did);
		return rankOf(member?.roles ?? [], roles()) < rank();
	};
	return {
		roles: roleOptions,
		members: memberOptions,
		canSelectRole,
		canSelectMember,
	};
};

export type AudienceOptions = ReturnType<typeof createAudienceOptions>;
