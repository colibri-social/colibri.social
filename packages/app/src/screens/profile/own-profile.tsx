import { type ProfileData, RoleBadge } from "@colibri-social/ui";
import { roleIdentity, rolesOf } from "../../data/roles";
import type { DataStore } from "../../data/store";
import { uiPresence } from "../members/member-adapter";

export const ownProfileData = (
	data: DataStore,
	spaceKey: string | undefined,
): ProfileData => {
	const viewer = data.viewer;
	const community = spaceKey ? data.spaceByKey(spaceKey) : undefined;
	const space = community ? data.space(community) : undefined;
	const member = space?.memberByDid(viewer.did);
	const presence = data.presenceOf(viewer.did) ?? viewer.presence;
	const status = presence?.status;
	const roles = space ? rolesOf(member, space.roleByKey) : [];
	return {
		displayName: viewer.displayName?.trim() || viewer.handle,
		nickname: member?.nickname,
		handle: viewer.handle,
		accentColor: viewer.theme?.accentColor,
		avatarSrc: viewer.avatar,
		avatarSeed: viewer.did,
		presence: uiPresence(presence),
		bannerSrc: viewer.banner,
		bannerColor: viewer.theme?.bannerColor,
		status: status?.text || undefined,
		statusEmoji: status?.emoji,
		statusShowWhileOffline: status?.showWhileOffline,
		bio: viewer.description?.trim() || undefined,
		roles: roles.map((role) => {
			const identity = roleIdentity(role);
			return {
				name: role.name,
				color: role.color,
				icon: identity.badge ? <RoleBadge role={identity} /> : undefined,
			};
		}),
		developer: data.controls().developerMode
			? {
					copyLabel: "Copy DID",
					copyValue: viewer.did,
					pdslsHref: `https://pdsls.dev/at://${viewer.did}`,
				}
			: undefined,
	};
};
