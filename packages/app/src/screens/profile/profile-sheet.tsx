import {
	type ProfileData,
	ProfileDrawer,
	ProfilePopover,
	type ProfilePopoverPlacement,
	RoleBadge,
} from "@colibri-social/ui";
import {
	createContext,
	createMemo,
	createSignal,
	onCleanup,
	onMount,
	type ParentProps,
	Show,
	useContext,
} from "solid-js";
import { nowPlayingOf } from "../../data/activity";
import { displayNameOf } from "../../data/adapters/authors";
import { profileBannerFill } from "../../data/profile-theme";
import { roleIdentity, rolesOf } from "../../data/roles";
import { useData } from "../../data/store";
import type { Did, ProfileView } from "../../data/types";
import { usePlatform } from "../../screen/platform";
import { uiPresence } from "../members/member-adapter";
import { OwnActivityPrompt } from "./activity-prompt";
import { createBioRenderer } from "./bio-links";
import { blueskyProfileLinks } from "./bluesky-link";
import { PrimaryBadge, SecondaryBadges } from "./user-badges";

type Target = { did: string; space?: string };

export type ProfileAnchor = {
	element?: HTMLElement;
	placement?: ProfilePopoverPlacement;
};

type ProfileSheetApi = {
	open: (did: string, space?: string, anchor?: ProfileAnchor) => void;
};

const ANCHOR_SELECTOR =
	'button, a, [role="button"], [data-member-row], [data-profile-anchor]';

const ProfileSheetContext = createContext<ProfileSheetApi>({ open: () => {} });

export const useProfileSheet = () => useContext(ProfileSheetContext);

export const ProfileSheetProvider = (props: ParentProps) => {
	const data = useData();
	const [target, setTarget] = createSignal<Target>();
	const [open, setOpen] = createSignal(false);
	const platform = usePlatform();
	const bio = createBioRenderer();
	const bioOf = bio.render;
	const [anchor, setAnchor] = createSignal<HTMLElement>();
	const [anchorRect, setAnchorRect] = createSignal<DOMRect>();
	const [placement, setPlacement] = createSignal<ProfilePopoverPlacement>();
	let lastPointer: HTMLElement | undefined;
	onMount(() => {
		const track = (event: PointerEvent) => {
			const target = event.target;
			if (!(target instanceof Element)) return;
			lastPointer =
				target.closest<HTMLElement>(ANCHOR_SELECTOR) ??
				(target instanceof HTMLElement ? target : undefined);
		};
		document.addEventListener("pointerdown", track, true);
		onCleanup(() => document.removeEventListener("pointerdown", track, true));
	});

	const profile = createMemo((): ProfileData | undefined => {
		const current = target();
		if (!current) return undefined;
		const community = current.space
			? data.spaceByKey(current.space)
			: undefined;
		const space = community ? data.space(community) : undefined;
		const member = space?.memberByDid(current.did as Did);
		const actor: ProfileView | undefined =
			member?.actor ??
			(current.did === data.viewer.did ? data.viewer : undefined);
		if (!actor) return undefined;
		const presence = data.presenceOf(actor.did) ?? actor.presence;
		const roles = space ? rolesOf(member, space.roleByKey) : [];
		const status = presence?.status;
		const self = actor.did === data.viewer.did;
		return {
			displayName: displayNameOf(actor),
			nickname: member?.nickname,
			handle: actor.handle,
			pronouns: actor.pronouns,
			accentColor: actor.theme?.accentColor,
			avatarSrc: actor.avatar,
			avatarSeed: actor.did,
			presence: uiPresence(presence),
			bannerSrc: actor.banner,
			bannerColor: profileBannerFill(actor.theme),
			badge: <PrimaryBadge profile={actor} size="sm" />,
			appBadge: <SecondaryBadges profile={actor} />,
			links: blueskyProfileLinks(data.preferences, actor.did),
			status: status?.text,
			statusEmoji: status?.emoji,
			statusShowWhileOffline: status?.showWhileOffline,
			bio: bioOf(actor.description),
			nowPlaying: nowPlayingOf(presence, bio.openLink),
			activityPrompt: self ? <OwnActivityPrompt tone="secondary" /> : undefined,
			self,
			roles: roles.map((role) => {
				const identity = roleIdentity(role);
				return {
					name: role.name,
					color: role.color,
					icon: identity.badge ? <RoleBadge role={identity} /> : undefined,
				};
			}),
			developer: {
				copyLabel: "Copy DID",
				copyValue: actor.did,
				pdslsHref: `https://pdsls.dev/at://${actor.did}`,
			},
		};
	});

	const api: ProfileSheetApi = {
		open: (did, space, at) => {
			const focused =
				document.activeElement instanceof HTMLElement &&
				document.activeElement !== document.body
					? document.activeElement
					: undefined;
			const element = at?.element ?? lastPointer ?? focused;
			const connected = element?.isConnected ? element : undefined;
			setAnchor(connected);
			setAnchorRect(connected?.getBoundingClientRect());
			setPlacement(at?.placement);
			setTarget({ did, space });
			setOpen(true);
		},
	};

	return (
		<ProfileSheetContext.Provider value={api}>
			{props.children}
			<Show
				when={platform() === "desktop"}
				fallback={
					<ProfileDrawer
						open={open()}
						onOpenChange={setOpen}
						profile={profile()}
						loading={open() && !profile()}
					/>
				}
			>
				<ProfilePopover
					open={open() && !!anchor()}
					onOpenChange={setOpen}
					anchor={anchor}
					anchorRect={anchorRect}
					placement={placement() ?? "left-start"}
					profile={profile()}
					loading={open() && !profile()}
				/>
			</Show>
			<bio.LinkWarningOutlet />
		</ProfileSheetContext.Provider>
	);
};
