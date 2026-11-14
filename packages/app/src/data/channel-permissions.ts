import {
	CHANNEL_PERMISSIONS,
	type ChannelPermission,
} from "@colibri-social/lexicons";
import type {
	CategoryView,
	ChannelView,
	CommunityView,
	Did,
	PermissionOverride,
	RoleView,
} from "./types";
import { VOICE_CHANNEL } from "./types";

export type { ChannelPermission };

type Answer = "allow" | "deny" | undefined;

type OverrideScope = { permissionOverrides?: readonly PermissionOverride[] };

export type PermissionHolder = {
	did: Did;
	roles: readonly string[];
	owner?: boolean;
};

export type SpaceRoles = readonly RoleView[];

export const BASELINE_PERMISSIONS: readonly string[] = [
	"channel.view",
	"message.send",
	"voice.connect",
];

export const postingPermission = (
	channel: Pick<ChannelView, "type">,
): ChannelPermission => {
	return channel.type === VOICE_CHANNEL ? "voice.connect" : "message.send";
};

const answerOf = (
	override: PermissionOverride | undefined,
	permission: string,
): Answer => {
	if (override?.deny?.includes(permission)) return "deny";
	if (override?.allow?.includes(permission)) return "allow";
	return undefined;
};

const heldRoles = (holder: PermissionHolder, roles: SpaceRoles) => {
	return roles
		.filter((role) => role.default || holder.roles.includes(role.rkey))
		.sort((left, right) => {
			if (!!left.default !== !!right.default) return left.default ? 1 : -1;
			return right.position - left.position;
		});
};

const scopeAnswer = (
	holder: PermissionHolder,
	held: readonly RoleView[],
	scope: OverrideScope | undefined,
	permission: string,
): Answer => {
	const overrides = scope?.permissionOverrides ?? [];
	if (overrides.length === 0) return undefined;

	const personal = answerOf(
		overrides.find((override) => override.member === holder.did),
		permission,
	);
	if (personal) return personal;

	for (const role of held) {
		const answer = answerOf(
			overrides.find((override) => override.role === role.rkey),
			permission,
		);
		if (answer) return answer;
	}

	return undefined;
};

const holdsBase = (
	held: readonly RoleView[],
	roles: SpaceRoles,
	permission: string,
) => {
	if (held.some((role) => role.permissions?.includes(permission))) return true;
	if (!BASELINE_PERMISSIONS.includes(permission)) return false;

	return !roles.some((role) => role.permissions?.includes("channel.view"));
};

const isPrivileged = (holder: PermissionHolder, held: readonly RoleView[]) => {
	return !!holder.owner || held.some((role) => role.protected);
};

export type BasePermission = (permission: string) => boolean;

export const holderCan = (
	holder: PermissionHolder,
	roles: SpaceRoles,
	permission: string,
	channel: ChannelView,
	category?: OverrideScope,
	base?: BasePermission,
): boolean => {
	const held = heldRoles(holder, roles);
	if (isPrivileged(holder, held)) return true;

	const holds = base ?? ((key: string) => holdsBase(held, roles, key));

	const allowedIn = (key: string) => {
		const answer =
			scopeAnswer(holder, held, channel, key) ??
			scopeAnswer(holder, held, category, key);

		return answer ? answer === "allow" : holds(key);
	};

	if (!allowedIn("channel.view")) return false;

	return allowedIn(permission);
};

export const holderPermissions = (
	holder: PermissionHolder,
	roles: SpaceRoles,
	channel: ChannelView,
	category?: OverrideScope,
	base?: BasePermission,
): ChannelPermission[] => {
	return CHANNEL_PERMISSIONS.filter((permission) =>
		holderCan(holder, roles, permission, channel, category, base),
	);
};

const defaultViewAnswer = (
	scope: OverrideScope | undefined,
	roles: SpaceRoles,
): Answer => {
	const fallback = roles.find((role) => role.default);
	if (!fallback) return undefined;

	return answerOf(
		scope?.permissionOverrides?.find(
			(override) => override.role === fallback.rkey,
		),
		"channel.view",
	);
};

export const isPrivateCategory = (
	category: OverrideScope | undefined,
	roles: SpaceRoles,
) => {
	return defaultViewAnswer(category, roles) === "deny";
};

export const isPrivateChannel = (
	channel: ChannelView,
	category: OverrideScope | undefined,
	roles: SpaceRoles,
) => {
	const answer =
		defaultViewAnswer(channel, roles) ?? defaultViewAnswer(category, roles);

	return answer === "deny";
};

export const canReadChannel = (
	channel: ChannelView,
	category: CategoryView | undefined,
	roles: SpaceRoles,
	holder: PermissionHolder,
) => {
	return holderCan(holder, roles, "channel.view", channel, category);
};

export const viewerCan = (
	community: CommunityView | undefined,
	channel: ChannelView | undefined,
	permission: ChannelPermission,
) => {
	if (community?.viewer.isOwner) return true;
	if (channel?.viewer.permissions) {
		return channel.viewer.permissions.includes(permission);
	}

	return !!community?.viewer.permissions?.includes(permission);
};
