import type {
	AudienceRole,
	MemberIdentityData,
	PermissionOverrideTarget,
} from "@colibri-social/ui";
import { createMemo } from "solid-js";
import { isDefaultRole } from "../../../data/role-flags";
import { isVisibleRole, roleIdentity } from "../../../data/roles";
import type { SpaceData } from "../../../data/store";
import type { CommunityView } from "../../../data/types";
import { createAudienceOptions } from "../channel/audience";

export type OverrideTargets = {
	defaultRole: () => string | undefined;
	resolve: (key: string) => PermissionOverrideTarget | undefined;
	position: (target: PermissionOverrideTarget) => number;
	canTarget: (key: string) => boolean;
	roleOptions: () => AudienceRole[];
	memberOptions: () => MemberIdentityData[];
};

export const createOverrideTargets = (
	community: () => CommunityView | undefined,
	space: () => SpaceData | undefined,
): OverrideTargets => {
	const options = createAudienceOptions(community, space);
	const roles = createMemo(() => space()?.roles.value() ?? []);
	const defaultRole = createMemo(() => roles().find(isDefaultRole)?.rkey);

	const resolve = (key: string): PermissionOverrideTarget | undefined => {
		if (key.startsWith("role:")) {
			const rkey = key.slice("role:".length);
			const role = roles().find((entry) => entry.rkey === rkey);
			if (!role || !isVisibleRole(role)) return undefined;

			return {
				kind: "role",
				id: role.rkey,
				role: roleIdentity(role),
				isDefault: isDefaultRole(role),
			};
		}

		if (!key.startsWith("member:")) return undefined;

		const did = key.slice("member:".length);
		const member = options.members().find((entry) => entry.id === did);

		return {
			kind: "member",
			id: did,
			name: member?.name ?? did,
			handle: member?.handle,
			avatarSrc: member?.avatarSrc,
		};
	};

	const position = (target: PermissionOverrideTarget) => {
		if (target.kind !== "role") return 0;

		return roles().find((role) => role.rkey === target.id)?.position ?? 0;
	};

	const canTarget = (key: string) => {
		if (key.startsWith("member:")) return true;
		if (!key.startsWith("role:")) return false;

		return options.canSelectRole(key.slice("role:".length));
	};

	return {
		defaultRole,
		resolve,
		position,
		canTarget,
		roleOptions: options.roles,
		memberOptions: options.members,
	};
};
