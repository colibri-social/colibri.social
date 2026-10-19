import { type ProfileData, RoleBadge } from "@colibri-social/ui";
import type { JSX } from "solid-js";
import { nowPlayingOf } from "../../data/activity";
import { displayNameOf } from "../../data/adapters/authors";
import { uiStatus } from "../../data/adapters/status";
import { profileBannerFill } from "../../data/profile-theme";
import { roleIdentity, rolesOf } from "../../data/roles";
import type { DataStore } from "../../data/store";
import { uiPresence } from "../members/member-adapter";
import { OwnActivityPrompt } from "./activity-prompt";
import { blueskyProfileLinks } from "./bluesky-link";
import { PrimaryBadge, SecondaryBadges } from "./user-badges";

export const ownProfileData = (
	data: DataStore,
	spaceKey: string | undefined,
	renderBio: (text: string | undefined) => JSX.Element | undefined = (text) =>
		text?.trim() || undefined,
	openLink?: (href: string, label: string) => void,
): ProfileData => {
	const viewer = data.viewer;
	const community = spaceKey ? data.spaceByKey(spaceKey) : undefined;
	const space = community ? data.space(community) : undefined;
	const member = space?.memberByDid(viewer.did);
	const presence = data.presenceOf(viewer.did) ?? viewer.presence;
	const status = uiStatus(presence?.status, data.emoji);
	const roles = space ? rolesOf(member, space.roleByKey) : [];
	return {
		displayName: displayNameOf(viewer),
		nickname: member?.nickname,
		handle: viewer.handle,
		pronouns: viewer.pronouns,
		accentColor: viewer.theme?.accentColor,
		avatarSrc: viewer.avatar,
		avatarSeed: viewer.did,
		presence: uiPresence(presence),
		bannerSrc: viewer.banner,
		bannerColor: profileBannerFill(viewer.theme),
		badge: <PrimaryBadge profile={viewer} size="sm" />,
		appBadge: <SecondaryBadges profile={viewer} />,
		links: blueskyProfileLinks(data.preferences, viewer.did),
		status: status?.text,
		statusEmoji: status?.emoji,
		statusCustomEmoji: status?.customEmoji,
		statusShowWhileOffline: status?.showWhileOffline,
		bio: renderBio(viewer.description),
		nowPlaying: nowPlayingOf(presence, openLink),
		activityPrompt: <OwnActivityPrompt tone="secondary" />,
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
