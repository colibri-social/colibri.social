import {
	copyText,
	type ProfileData,
	ProfileDrawer,
	type ProfileMenuActions,
	ProfilePopover,
	type ProfilePopoverPlacement,
	RoleBadge,
	recordExplorerHref,
	toast,
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
import { uiStatus } from "../../data/adapters/status";
import { profileBannerFill } from "../../data/profile-theme";
import { roleIdentity, rolesOf } from "../../data/roles";
import { useData } from "../../data/store";
import type { Did, ProfileView } from "../../data/types";
import { openInRecordExplorer } from "../../native/open-in-explorer";
import { usePlatform } from "../../screen/platform";
import { createCustomEmojiDrawer } from "../channel/message/custom-emoji-drawer";
import { createBlockFlow } from "../members/block-flow";
import { uiPresence } from "../members/member-adapter";
import { MemberMenuProvider, useMemberMenu } from "../members/member-menu";
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
	const blocking = createBlockFlow();
	const emojiDrawer = createCustomEmojiDrawer({
		data,
		community: () => {
			const space = target()?.space;

			return space ? data.spaceByKey(space)?.did : undefined;
		},
	});
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
		const status = uiStatus(presence?.status, data.emoji);
		const self = actor.did === data.viewer.did;
		const name = displayNameOf(actor);

		return {
			displayName: name,
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
			statusCustomEmoji: status?.customEmoji,
			statusShowWhileOffline: status?.showWhileOffline,
			onStatusCustomEmojiClick: self
				? undefined
				: (emoji, element) => emojiDrawer.open(emoji, element),
			bio: bioOf(actor.description),
			nowPlaying: nowPlayingOf(presence, bio.openLink),
			activityPrompt: self ? <OwnActivityPrompt tone="secondary" /> : undefined,
			self,
			blocked: !self && blocking.isBlocked(actor.did),
			onUnblock: self
				? undefined
				: () => void blocking.unblock(actor.did, name),
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
						copyValue: actor.did,
						explorerHref: recordExplorerHref(actor.did),
					}
				: undefined,
		};
	});

	const menuName = () => {
		const current = profile();

		return current ? (current.nickname ?? current.displayName) : "";
	};

	const profileActions: ProfileMenuActions = {
		get blocked() {
			const did = target()?.did;

			return !!did && blocking.isBlocked(did);
		},
		get onBlock() {
			const did = target()?.did;
			if (!did || !blocking.canBlock(did)) return undefined;

			return () => blocking.ask(did, menuName());
		},
		get onUnblock() {
			const did = target()?.did;
			if (!did || !blocking.canBlock(did)) return undefined;

			return () => void blocking.unblock(did, menuName());
		},
		get onCopyDid() {
			const did = target()?.did;
			if (!did) return undefined;

			return () => {
				const name = menuName();

				void copyText(did).then(() => toast.success(`DID for ${name} copied`));
			};
		},
		get developerMode() {
			return data.controls().developerMode;
		},
		get onShowInExplorer() {
			const did = target()?.did;
			if (!did) return undefined;

			return () => openInRecordExplorer(did);
		},
	};

	const closing = (action?: () => void) => {
		if (!action) return undefined;

		return () => {
			setOpen(false);
			action();
		};
	};

	const Overlays = () => {
		const memberMenu = useMemberMenu();
		const spaceActions = createMemo(() => {
			const current = target();
			if (!current?.space || current.did === data.viewer.did) return undefined;

			return memberMenu.actions({
				did: current.did as Did,
				space: current.space,
			});
		});
		const source = () => spaceActions() ?? profileActions;
		const menu: ProfileMenuActions = {
			get voice() {
				return spaceActions()?.voice;
			},
			get roles() {
				return spaceActions()?.roles;
			},
			get onRoleChange() {
				return spaceActions()?.onRoleChange;
			},
			get onKick() {
				return closing(spaceActions()?.onKick);
			},
			get onBan() {
				return closing(spaceActions()?.onBan);
			},
			get blocked() {
				return source().blocked;
			},
			get onBlock() {
				return closing(source().onBlock);
			},
			get onUnblock() {
				return source().onUnblock;
			},
			get onCopyDid() {
				return source().onCopyDid;
			},
			get developerMode() {
				return source().developerMode;
			},
			get onShowInExplorer() {
				return source().onShowInExplorer;
			},
		};

		return (
			<Show
				when={platform() === "desktop"}
				fallback={
					<ProfileDrawer
						open={open()}
						onOpenChange={setOpen}
						profile={profile()}
						menu={menu}
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
					menu={menu}
					loading={open() && !profile()}
				/>
			</Show>
		);
	};

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
			<MemberMenuProvider>
				{props.children}
				<Overlays />
			</MemberMenuProvider>
			<emojiDrawer.Overlay />
			<bio.LinkWarningOutlet />
			<blocking.Dialog />
		</ProfileSheetContext.Provider>
	);
};
