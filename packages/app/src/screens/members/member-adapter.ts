import type { HoistedRole, Member } from "@colibri-social/ui";
import { memberActivityOf } from "../../data/activity";
import { displayNameOf } from "../../data/adapters/authors";
import { uiPresence } from "../../data/adapters/presence";
import {
	roleIdentity,
	rolesOf,
	topColoredRole,
	topHoistedRole,
	visibleRoles,
} from "../../data/roles";
import type { MemberView, Presence, RoleView } from "../../data/types";

export { uiPresence };

export const toListMember = (
	member: MemberView,
	options: {
		roleByKey: (rkey: string) => RoleView | undefined;
		presence: Presence | undefined;
		ownerRole?: string;
	},
): Member => {
	const roles = rolesOf(member, options.roleByKey);
	const colored = topColoredRole(roles);
	const hoisted = topHoistedRole(roles);
	const status = options.presence?.status;
	return {
		id: member.actor.did,
		name: displayNameOf(member.actor, member),
		avatarSrc: member.actor.avatar,
		presence: uiPresence(options.presence),
		status: status
			? [status.emoji, status.text].filter(Boolean).join(" ")
			: undefined,
		statusShowWhileOffline: status?.showWhileOffline,
		role: colored ? roleIdentity(colored) : undefined,
		hoistedRoleId: hoisted?.rkey,
		bot: member.actor.isBot,
		owner: options.ownerRole ? member.roles.includes(options.ownerRole) : false,
		activity: memberActivityOf(options.presence),
	};
};

export const hoistedRoles = (roles: readonly RoleView[]): HoistedRole[] =>
	visibleRoles(roles)
		.filter((role) => role.hoisted)
		.sort((a, b) => b.position - a.position)
		.map((role) => ({ ...roleIdentity(role), id: role.rkey }));
