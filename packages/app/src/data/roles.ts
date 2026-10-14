import {
	isRoleBadgeIconName,
	type RoleBadgeValue,
	type RoleIdentity,
} from "@colibri-social/ui";
import type { MemberView, RoleView } from "./types";

const ICON_BADGE = "social.colibri.beta.community.defs#roleIconBadge";
const IMAGE_BADGE = "social.colibri.beta.community.defs#roleImageBadgeView";

export const roleBadge = (role: RoleView): RoleBadgeValue | undefined => {
	const badge = role.badge as
		| { $type?: string; icon?: string; color?: string; image?: string }
		| undefined;
	if (!badge) return undefined;
	if (badge.$type === IMAGE_BADGE || badge.image) {
		return badge.image ? { kind: "image", url: badge.image } : undefined;
	}
	if (badge.$type === ICON_BADGE || badge.icon) {
		if (!badge.icon || !isRoleBadgeIconName(badge.icon)) return undefined;
		return { kind: "icon", name: badge.icon, color: badge.color };
	}
	return undefined;
};

export const roleIdentity = (role: RoleView): RoleIdentity => ({
	id: role.rkey,
	name: role.name,
	color: role.color,
	badge: roleBadge(role),
});

export const rolesOf = (
	member: MemberView | undefined,
	roleByKey: (rkey: string) => RoleView | undefined,
) =>
	(member?.roles ?? [])
		.map((rkey) => roleByKey(rkey))
		.filter((role): role is RoleView => !!role)
		.sort((a, b) => b.position - a.position);

export const topColoredRole = (roles: readonly RoleView[]) =>
	roles.find((role) => !!role.color);

export const topHoistedRole = (roles: readonly RoleView[]) =>
	roles.find((role) => role.hoisted);
