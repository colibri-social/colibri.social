import {
	isRoleBadgeIconName,
	type RoleBadgeValue,
	type RoleIdentity,
} from "@colibri-social/ui";
import { isDefaultRole } from "./role-flags";
import type { MemberView, RoleView } from "./types";

export { isDefaultRole };

const ICON_BADGE = "social.colibri.beta.community.defs#roleIconBadge";
const IMAGE_BADGE = "social.colibri.beta.community.defs#roleImageBadgeView";
const EMOJI_BADGE = "social.colibri.beta.community.defs#roleEmojiBadgeView";

type WireRoleBadge = {
	$type?: string;
	icon?: string;
	color?: string;
	image?: string;
	emoji?: string;
	customEmoji?: { uri?: string };
	name?: string;
};

const emojiBadge = (badge: WireRoleBadge): RoleBadgeValue | undefined => {
	const uri = badge.customEmoji?.uri;
	if (uri) {
		return badge.image
			? {
					kind: "emoji",
					custom: { id: uri, name: badge.name ?? "", src: badge.image },
				}
			: undefined;
	}
	return badge.emoji ? { kind: "emoji", emoji: badge.emoji } : undefined;
};

export const roleBadge = (role: RoleView): RoleBadgeValue | undefined => {
	const badge = role.badge as WireRoleBadge | undefined;
	if (!badge) return undefined;
	if (badge.$type === EMOJI_BADGE || badge.emoji || badge.customEmoji) {
		return emojiBadge(badge);
	}
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

export const isVisibleRole = (role: RoleView) => !role.protected;

export const isChipRole = (role: RoleView) =>
	isVisibleRole(role) && !isDefaultRole(role);

export const visibleRoles = (roles: readonly RoleView[]) =>
	roles.filter(isChipRole);

export const rolesOf = (
	member: MemberView | undefined,
	roleByKey: (rkey: string) => RoleView | undefined,
) =>
	(member?.roles ?? [])
		.map((rkey) => roleByKey(rkey))
		.filter((role): role is RoleView => !!role && isChipRole(role))
		.sort((a, b) => b.position - a.position);

export const topColoredRole = (roles: readonly RoleView[]) =>
	roles.find((role) => isChipRole(role) && !!role.color);

export const topHoistedRole = (roles: readonly RoleView[]) =>
	roles.find((role) => isChipRole(role) && role.hoisted);
