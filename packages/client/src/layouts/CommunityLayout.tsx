import { useParams, useSearchParams } from "@solidjs/router";
import {
	createEffect,
	createSignal,
	type ParentComponent,
	Show,
	Suspense,
} from "solid-js";
import CaretDownIcon from "~icons/ph/caret-down";
import GearIcon from "~icons/ph/gear";
import SignOutIcon from "~icons/ph/sign-out";
import UsersIcon from "~icons/ph/users-fill";
import { urlSegmentToUri } from "../atproto/community-uri-to-url-compatible";
import { resolveBlob } from "../atproto/resolve-blob";
import { ChannelList } from "../components/app/community/ChannelList";
import { ChannelSidebarResizer } from "../components/app/community/ChannelSidebarResizer";
import { CommunitySettingsModal } from "../components/app/community/CommunitySettingsModal";
import { LeaveCommunityModal } from "../components/app/community/LeaveCommunityModal";
import { LegacyCommunityLock } from "../components/app/community/LegacyCommunityLock";
import { MemberProfileModal } from "../components/app/community/MemberProfileModal";
import { MemberSidebar } from "../components/app/community/MemberSidebar";
import User from "../components/app/user";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuPortal,
	DropdownMenuTrigger,
} from "../components/ui/DropdownMenu";
import {
	handoffDrawer,
	isDrawerOpen,
	MenuDrawer,
	MenuDrawerItem,
} from "../components/ui/MenuDrawer";
import {
	CommunityContextProvider,
	useCommunityContext,
	usePermissions,
} from "../contexts/Community";
import { MemberProfileContextProvider } from "../contexts/MemberProfile";
import { useUserContext } from "../contexts/User";
import { useUserPreferences } from "../contexts/UserPreferences";
import createMediaQuery from "../utils/create-media-query";
import { createSwipe, type SwipeOptions } from "../utils/create-swipe";
import { getChannelParam } from "../utils/get-param";
import {
	createChannelHistoryNormalizer,
	createMobilePane,
	PANE_COMMIT_RATIO,
	useIsMobile,
} from "../utils/mobile-pane";
import { isDesktopNative } from "../utils/platform";
import { publishShellTitle } from "../utils/shell-title";

const CommunityHeader = () => {
	const user = useUserContext();
	const community = useCommunityContext();
	const { canManageApprovals, canManageCommunity } = usePermissions();
	const [settingsOpen, setSettingsOpen] = createSignal(false);
	const [leaveOpen, setLeaveOpen] = createSignal(false);
	const [menuOpen, setMenuOpen] = createSignal(false);
	const isMobile = useIsMobile();
	const [searchParams, setSearchParams] = useSearchParams();

	const pendingApplications = () =>
		canManageApprovals(user.did) ? community().applications.length : 0;

	const isOwner = () => community().ownerDid() === user.did;

	const hasBanner = () => community().community.banner !== undefined;

	// Opened from the sidebar context menu's "Settings": it navigates here with
	// `?settings=open`, which we honour once and then clear.
	createEffect(() => {
		if (searchParams.settings === "open") {
			setSettingsOpen(true);
			setSearchParams({ settings: undefined });
		}
	});

	return (
		<>
			<div
				class="w-full border-b border-border flex flex-col pb-4 pt-3 px-3 relative"
				classList={{ "h-40": hasBanner() }}
			>
				<Show when={hasBanner()}>
					<img
						class="absolute top-0 left-0 right-0 w-full h-full object-cover"
						src={resolveBlob(community().did, community().community.banner)}
						alt=""
					/>
					<div class="absolute top-0 z-1 bg-linear-to-b from-black via-black/50 to-transparent w-full h-full left-0"></div>
				</Show>
				<Show
					when={isMobile()}
					fallback={
						<DropdownMenu placement="bottom-start">
							<DropdownMenuTrigger
								as="button"
								type="button"
								class="flex flex-row items-center gap-3 text-left px-2 py-1 rounded-md hover:bg-muted/50 transition-all duration-75 cursor-pointer w-fit max-w-full aria-expanded:[&>svg]:rotate-180 aria-expanded:bg-muted/50 z-10"
							>
								<h2
									class="m-0 text-xl min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
									classList={{ "text-neutral-50": hasBanner() }}
								>
									{community().community.name}
								</h2>
								<Show when={pendingApplications() > 0}>
									<span class="text-xs leading-none font-medium bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 min-w-5 shrink-0 text-center">
										{pendingApplications()}
									</span>
								</Show>
								<CaretDownIcon class="text-muted-foreground mt-0.5 text-sm shrink-0" />
							</DropdownMenuTrigger>
							<DropdownMenuPortal>
								<DropdownMenuContent class="min-w-48 w-66.5">
									<Show when={canManageCommunity(user.did)}>
										<DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
											<GearIcon />
											<span>Settings</span>
											<Show when={pendingApplications() > 0}>
												<span class="ml-auto text-xs leading-none font-medium bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 min-w-5 text-center">
													{pendingApplications()}
												</span>
											</Show>
										</DropdownMenuItem>
									</Show>
									<Show when={!isOwner()}>
										<DropdownMenuItem
											class="text-destructive data-highlighted:text-destructive"
											onSelect={() => setLeaveOpen(true)}
										>
											<SignOutIcon />
											<span>Leave Community</span>
										</DropdownMenuItem>
									</Show>
								</DropdownMenuContent>
							</DropdownMenuPortal>
						</DropdownMenu>
					}
				>
					<button
						type="button"
						onClick={() => setMenuOpen(true)}
						class="flex flex-row items-center gap-3 text-left px-2 py-1 rounded-md hover:bg-muted/50 transition-all duration-75 cursor-pointer w-fit max-w-full z-10"
					>
						<h2
							class="m-0 text-xl min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
							classList={{ "text-neutral-50": hasBanner() }}
						>
							{community().community.name}
						</h2>
						<Show when={pendingApplications() > 0}>
							<span class="text-xs leading-none font-medium bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 min-w-5 shrink-0 text-center">
								{pendingApplications()}
							</span>
						</Show>
						<CaretDownIcon class="text-muted-foreground mt-0.5 text-sm shrink-0" />
					</button>
					<MenuDrawer
						open={menuOpen()}
						onOpenChange={setMenuOpen}
						title={community().community.name}
					>
						<Show when={canManageCommunity(user.did)}>
							<MenuDrawerItem
								onClick={() =>
									handoffDrawer(
										() => setMenuOpen(false),
										() => setSettingsOpen(true),
									)
								}
							>
								<GearIcon />
								<span>Settings</span>
								<Show when={pendingApplications() > 0}>
									<span class="ml-auto text-xs leading-none font-medium bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 min-w-5 text-center">
										{pendingApplications()}
									</span>
								</Show>
							</MenuDrawerItem>
						</Show>
						<Show when={!isOwner()}>
							<MenuDrawerItem
								destructive
								onClick={() =>
									handoffDrawer(
										() => setMenuOpen(false),
										() => setLeaveOpen(true),
									)
								}
							>
								<SignOutIcon />
								<span>Leave Community</span>
							</MenuDrawerItem>
						</Show>
					</MenuDrawer>
				</Show>
			</div>
			<CommunitySettingsModal open={settingsOpen} setOpen={setSettingsOpen} />
			<LeaveCommunityModal
				open={leaveOpen}
				setOpen={setLeaveOpen}
				communityName={community().community.name}
				communityUri={community().community.uri}
			/>
		</>
	);
};

const CommunityLayout: ParentComponent = (props) => {
	const { preferences, setChannelSidebarWidth } = useUserPreferences();
	const community = useCommunityContext();
	const [dragWidth, setDragWidth] = createSignal<number | null>(null);
	const [resizingSidebar, setResizingSidebar] = createSignal(false);
	const sidebarWidth = () => dragWidth() ?? preferences().channelSidebarWidth;
	const displayMembersAsSheet = createMediaQuery("(max-width: 1280px)");
	const {
		isMobile,
		currentPane,
		popPane,
		pushDeeper,
		updateDrag,
		paneTranslate,
		isDragging,
	} = createMobilePane();
	createChannelHistoryNormalizer();

	publishShellTitle(
		() => ({
			name: community().community.name,
			picture: resolveBlob(community().did, community().community.picture),
		}),
		() => {
			const rkey = getChannelParam();
			if (!rkey) return undefined;
			const found = community().channels.find(
				(c) => c.uri.split("/").pop() === rkey,
			);
			return found ? { name: found.name, type: found.type } : undefined;
		},
	);

	// With swipe-to-reply turned on, a left swipe over a channel belongs to the
	// message row, so the members pane is not reachable by gesture at all — not
	// over a message, and not over the gaps between them either. The channel
	// header's members button is the way in. Anywhere else in the stack (nav to
	// chat, and every swipe right) is unaffected.
	const swipeLeftOpensMembers = () =>
		preferences().controls.swipeLeftAction !== "reply";

	// Swipe right = back up the stack, swipe left = deeper
	const swipe: SwipeOptions = {
		enabled: () => isMobile() && !isDrawerOpen(),
		commitRatio: PANE_COMMIT_RATIO,
		canSwipe: (dx) =>
			dx > 0 || currentPane() !== "chat" || swipeLeftOpensMembers(),
		onSwipeRight: () => popPane(),
		onSwipeLeft: () => pushDeeper(),
		onSwipeMove: updateDrag,
	};

	return (
		<div
			class="bg-background w-full h-full flex relative overflow-clip"
			style={{ "--channel-sidebar-width": `${sidebarWidth()}px` }}
			classList={{
				"border-t border-l border-border": !isMobile(),
				"rounded-tl-xl": !isMobile() && isDesktopNative(),
				"select-none": resizingSidebar(),
			}}
		>
			<aside
				ref={(el) => createSwipe(el, swipe)}
				class="border-border flex flex-col bg-background"
				style={{ translate: paneTranslate("nav") }}
				classList={{
					"h-full relative border-r w-[var(--channel-sidebar-width)] min-w-[var(--channel-sidebar-width)]":
						!isMobile(),
					"absolute inset-0 w-full pl-14 z-30 will-change-pane": isMobile(),
					"transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none":
						isMobile() && !isDragging(),
				}}
			>
				<CommunityHeader />
				<div class="p-4 flex flex-col gap-2 border-b border-border">
					<div class="flex flex-row justify-between items-center gap-2 pl-0.5 pr-1.5">
						<div class="flex flex-row justify-between items-center gap-2">
							<UsersIcon class="text-muted-foreground size-4.5" />
							<small class="text-muted-foreground pl-0.25">Members</small>
						</div>
						<Suspense
							fallback={
								<small class="text-muted-foreground animate-pulse">??</small>
							}
						>
							<small class="text-muted-foreground">
								{community().members.length ?? "??"}
							</small>
						</Suspense>
					</div>
				</div>
				<ChannelList />
				<User.Status />
				<Show when={!isMobile()}>
					<ChannelSidebarResizer
						width={sidebarWidth}
						onDrag={setDragWidth}
						onCommit={setChannelSidebarWidth}
						onResizingChange={setResizingSidebar}
					/>
				</Show>
			</aside>
			<div
				ref={(el) => createSwipe(el, swipe)}
				class="flex flex-col"
				style={{ translate: paneTranslate("chat") }}
				classList={{
					"w-full h-full": !isMobile(),
					"max-h-[calc(100vh-var(--titlebar-height)-1px)]": !isMobile(),
					"max-w-[calc(100vw-var(--channel-sidebar-width)-288px-56px-1px)]":
						!isMobile() &&
						!displayMembersAsSheet() &&
						preferences().membersListVisible,
					"max-w-[calc(100vw-var(--channel-sidebar-width)-56px-1px)]":
						!isMobile() &&
						(displayMembersAsSheet() || !preferences().membersListVisible),
					"absolute inset-0 w-full h-full max-w-none! z-20 will-change-pane":
						isMobile(),
					"transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none":
						isMobile() && !isDragging(),
				}}
			>
				{props.children}
			</div>
			<MemberSidebar />
		</div>
	);
};

const CommunityLayoutWithContext: ParentComponent = (props) => {
	const user = useUserContext();
	const params = useParams();

	// A legacy (un-migrated) community can't be opened
	const legacyCommunity = () => {
		const uri = urlSegmentToUri(params.community!);
		return user.communities.find((c) => c.uri === uri && c.isLegacy);
	};

	return (
		<Show
			when={legacyCommunity()}
			fallback={
				<CommunityContextProvider>
					<MemberProfileContextProvider>
						<MemberProfileModal />
						<CommunityLayout>{props.children}</CommunityLayout>
					</MemberProfileContextProvider>
				</CommunityContextProvider>
			}
		>
			{(community) => <LegacyCommunityLock community={community()} />}
		</Show>
	);
};

export default CommunityLayoutWithContext;
