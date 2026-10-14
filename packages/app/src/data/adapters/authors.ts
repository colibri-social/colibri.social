import type { MessageAuthor, RoleIdentity } from "@colibri-social/ui";
import { roleIdentity, rolesOf, topColoredRole } from "../roles";
import type { MemberView, ProfileView, RoleView } from "../types";

export type AuthorDirectory = {
	members: ReadonlyMap<string, MemberView>;
	roles: ReadonlyMap<string, RoleView>;
};

export const memberRoles = (
	member: MemberView | undefined,
	roles: ReadonlyMap<string, RoleView>,
) => rolesOf(member, (rkey) => roles.get(rkey));

export const roleIdentityFor = (
	ranked: readonly RoleView[],
): RoleIdentity | undefined => {
	const top = topColoredRole(ranked);
	return top ? roleIdentity(top) : undefined;
};

export const displayNameOf = (
	profile: Pick<ProfileView, "displayName" | "handle"> | undefined,
	member?: Pick<MemberView, "nickname">,
) =>
	member?.nickname?.trim() ||
	profile?.displayName?.trim() ||
	profile?.handle ||
	"Unknown user";

export const toMessageAuthor = (
	profile: ProfileView,
	directory: AuthorDirectory,
): MessageAuthor => {
	const member = directory.members.get(profile.did);
	const actor = member?.actor ?? profile;
	return {
		name: displayNameOf(actor, member),
		avatarSrc: actor.avatar,
		seed: profile.did,
		nameColor: actor.theme?.accentColor,
		role: roleIdentityFor(memberRoles(member, directory.roles)),
	};
};

export const authorForDid = (
	did: string,
	directory: AuthorDirectory,
): MessageAuthor | undefined => {
	const member = directory.members.get(did);
	if (!member) return undefined;
	return toMessageAuthor(member.actor, directory);
};

const PLATFORM_NAMES: Record<string, string> = {
	matrix: "Matrix",
	telegram: "Telegram",
	slack: "Slack",
	irc: "IRC",
	xmpp: "XMPP",
};

export const bridgePlatformName = (platform: string) =>
	PLATFORM_NAMES[platform.toLowerCase()] ??
	platform.charAt(0).toUpperCase() + platform.slice(1);

export const viaLabel = (profile: ProfileView) =>
	profile.bridge ? bridgePlatformName(profile.bridge.platform) : undefined;
