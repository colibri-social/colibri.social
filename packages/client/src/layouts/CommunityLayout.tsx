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
import { urlSegmentToUri } from "../atproto/community-uri-to-url-compatible";
import { ChannelList } from "../components/app/community/ChannelList";
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
import { isTauriRuntime } from "../notifications";
import createMediaQuery from "../utils/create-media-query";
import { createSwipe, type SwipeOptions } from "../utils/create-swipe";
import {
	createMobilePane,
	PANE_COMMIT_RATIO,
	useIsMobile,
} from "../utils/mobile-pane";

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
			<div class="w-full border-b border-border flex flex-col justify-center pb-4 pt-3 px-3">
				<Show
					when={isMobile()}
					fallback={
						<DropdownMenu placement="bottom-start">
							<DropdownMenuTrigger
								as="button"
								type="button"
								class="flex flex-row items-center gap-3 text-left px-2 py-1 rounded-md hover:bg-muted/50 transition-all duration-75 cursor-pointer w-fit aria-expanded:[&>svg]:rotate-180 aria-expanded:bg-muted/50"
							>
								<h2 class="m-0 text-xl w-full text-ellipsis whitespace-nowrap">
									{community().community.name}
								</h2>
								<Show when={pendingApplications() > 0}>
									<span class="text-xs leading-none font-medium bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 min-w-5 text-center">
										{pendingApplications()}
									</span>
								</Show>
								<CaretDownIcon class="text-muted-foreground mt-0.5 text-sm " />
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
						class="flex flex-row items-center gap-3 text-left px-2 py-1 rounded-md hover:bg-muted/50 transition-all duration-75 cursor-pointer w-fit"
					>
						<h2 class="m-0 text-xl w-full text-ellipsis whitespace-nowrap">
							{community().community.name}
						</h2>
						<Show when={pendingApplications() > 0}>
							<span class="text-xs leading-none font-medium bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 min-w-5 text-center">
								{pendingApplications()}
							</span>
						</Show>
						<CaretDownIcon class="text-muted-foreground mt-0.5 text-sm" />
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
				<Suspense
					fallback={
						<small class="text-muted-foreground animate-pulse px-2">
							Loading members...
						</small>
					}
				>
					<small class="text-muted-foreground px-2">
						{community().members.length ?? "???"} Member
						{community().members.length === 1 ? "" : "s"}
					</small>
				</Suspense>
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
	const { preferences } = useUserPreferences();
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
			classList={{
				"rounded-tl-xl border-t border-l border-border": !isMobile(),
			}}
		>
			<aside
				ref={(el) => createSwipe(el, swipe)}
				class="border-border flex flex-col bg-background"
				style={{ translate: paneTranslate("nav") }}
				classList={{
					"h-full min-w-72 w-72 border-r": !isMobile(),
					"absolute inset-0 w-full pl-14 z-30 will-change-pane": isMobile(),
					"transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none":
						isMobile() && !isDragging(),
				}}
			>
				<CommunityHeader />
				<ChannelList />
				<User.Status />
			</aside>
			<div
				ref={(el) => createSwipe(el, swipe)}
				class="flex flex-col"
				style={{ translate: paneTranslate("chat") }}
				classList={{
					"w-full h-full": !isMobile(),
					"max-h-[calc(100vh-41px)]": !isMobile() && !isTauriRuntime(),
					"max-w-[calc(100vw-576px-56px-1px)]":
						!isMobile() &&
						!displayMembersAsSheet() &&
						preferences().membersListVisible,
					"max-w-[calc(100vw-288px-56px-1px)]":
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
