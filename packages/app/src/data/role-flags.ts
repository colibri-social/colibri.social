import type { RoleView } from "./types";

export const isDefaultRole = (role: RoleView) => role.default === true;

export const isMentionableRole = (role: RoleView) =>
	role.mentionable === true && !role.protected && !isDefaultRole(role);

export const isAssignableRole = (role: RoleView) =>
	!role.protected && !isDefaultRole(role);
