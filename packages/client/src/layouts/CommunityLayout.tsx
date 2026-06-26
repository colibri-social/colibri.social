import { useSearchParams } from "@solidjs/router";
import {
	createEffect,
	createSignal,
	type ParentComponent,
	Show,
	Suspense,
} from "solid-js";
import CaretDownIcon from "~icons/ph/caret-down";
import { ChannelList } from "../components/app/community/ChannelList";
import { CommunitySettingsModal } from "../components/app/community/CommunitySettingsModal";
import { LeaveCommunityModal } from "../components/app/community/LeaveCommunityModal";
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
	CommunityContextProvider,
	useCommunityContext,
	usePermissions,
} from "../contexts/Community";
import { MemberProfileContextProvider } from "../contexts/MemberProfile";
import { useUserContext } from "../contexts/User";
import { useUserPreferences } from "../contexts/UserPreferences";
import createMediaQuery from "../utils/create-media-query";

const CommunityHeader = () => {
	const user = useUserContext();
	const community = useCommunityContext();
	const { canManageApprovals } = usePermissions();
	const [settingsOpen, setSettingsOpen] = createSignal(false);
	const [leaveOpen, setLeaveOpen] = createSignal(false);
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
			<div class="w-full border-b border-border flex flex-col justify-center py-4 px-3">
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
							<DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
								Settings
								<Show when={pendingApplications() > 0}>
									<span class="ml-auto text-xs leading-none font-medium bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 min-w-5 text-center">
										{pendingApplications()}
									</span>
								</Show>
							</DropdownMenuItem>
							<Show when={!isOwner()}>
								<DropdownMenuItem
									class="text-destructive data-highlighted:text-destructive"
									onSelect={() => setLeaveOpen(true)}
								>
									Leave Community
								</DropdownMenuItem>
							</Show>
						</DropdownMenuContent>
					</DropdownMenuPortal>
				</DropdownMenu>
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

	return (
		<div class="bg-background w-full h-full rounded-tl-xl border-t border-l border-border flex relative overflow-hidden">
			<aside class="h-full min-w-72 w-72 border-r border-border flex flex-col">
				<CommunityHeader />
				<ChannelList />
				<User.Status />
			</aside>
			<div
				class="w-full h-full flex flex-col max-h-[calc(100vh-41px)]"
				classList={{
					"max-w-[calc(100vw-576px-56px-1px)]":
						!displayMembersAsSheet() && preferences().membersListVisible,
					"max-w-[calc(100vw-288px-56px-1px)]":
						displayMembersAsSheet() || !preferences().membersListVisible,
				}}
			>
				{props.children}
			</div>
			<MemberSidebar />
		</div>
	);
};

const CommunityLayoutWithContext: ParentComponent = (props) => (
	<CommunityContextProvider>
		<MemberProfileContextProvider>
			<MemberProfileModal />
			<CommunityLayout>{props.children}</CommunityLayout>
		</MemberProfileContextProvider>
	</CommunityContextProvider>
);

export default CommunityLayoutWithContext;
