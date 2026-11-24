import type { RoleView } from "./types";

export const isDefaultRole = (role: RoleView) => role.default === true;

export const isMentionableRole = (role: RoleView) =>
	role.mentionable === true && !role.protected && !isDefaultRole(role);

export const isAssignableRole = (role: RoleView) =>
	!role.protected && !isDefaultRole(role);

export const compareRoles = (a: RoleView, b: RoleView) => {
	const pinned = Number(isDefaultRole(a)) - Number(isDefaultRole(b));
	return pinned !== 0 ? pinned : b.position - a.position;
};
