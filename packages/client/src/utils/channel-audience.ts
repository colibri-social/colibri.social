import type { ChannelView, RoleView } from "../atproto/views";
import type { Member } from "../contexts/community-payload";

export type ChannelAudience = {
	channel: Pick<ChannelView, "visibleToRoles" | "visibleToMembers">;
	roles: ReadonlyArray<RoleView>;
	ownerDid: string | undefined;
};

const isPrivate = (audience: ChannelAudience): boolean =>
	(audience.channel.visibleToRoles?.length ?? 0) > 0 ||
	(audience.channel.visibleToMembers?.length ?? 0) > 0;

export const canSeeChannel = (
	member: Pick<Member, "did" | "roles">,
	audience: ChannelAudience,
): boolean => {
	if (member.did === audience.ownerDid) return true;

	const held = new Set(member.roles);
	const protectedRole = audience.roles.some(
		(role) => role.protected && held.has(role.rkey),
	);
	if (protectedRole) return true;

	if (!isPrivate(audience)) return true;
	const named: ReadonlyArray<string> = audience.channel.visibleToMembers ?? [];
	if (named.includes(member.did)) return true;
	return (audience.channel.visibleToRoles ?? []).some((rkey) => held.has(rkey));
};

export const channelAudience = <T extends Pick<Member, "did" | "roles">>(
	members: ReadonlyArray<T>,
	audience: ChannelAudience,
): T[] => members.filter((member) => canSeeChannel(member, audience));
