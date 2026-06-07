import type { Details } from "@kobalte/core/file-field";
import { createAsync, query, useParams } from "@solidjs/router";
import twemoji from "@twemoji/api";
import {
	createEffect,
	createMemo,
	createSignal,
	For,
	Match,
	onCleanup,
	type ParentComponent,
	Show,
	Suspense,
	Switch,
	untrack,
} from "solid-js";
import { toast } from "somoto";
import createMediaQuery from "../utils/create-media-query";
import { ChannelList } from "../components/app/community/ChannelList";
import { CommunitySettingsModal } from "../components/app/community/CommunitySettingsModal";
import { LeaveCommunityModal } from "../components/app/community/LeaveCommunityModal";
import User from "../components/app/user";
import {
	CommunityContextProvider,
	useCommunityContext,
} from "../contexts/Community";
import { VoiceChatContextProvider } from "../contexts/VoiceChat";
import { MemberSidebar } from "../components/app/community/MemberSidebar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuPortal,
	DropdownMenuTrigger,
} from "../components/ui/DropdownMenu";
import CaretDownIcon from "~icons/ph/caret-down";
import { useUserPreferences } from "../contexts/UserPreferences";

const CommunityHeader = () => {
	const community = useCommunityContext();
	const [settingsOpen, setSettingsOpen] = createSignal(false);
	const [leaveOpen, setLeaveOpen] = createSignal(false);

	return (
		<>
			<div class="w-full border-b border-border flex flex-col justify-center p-4">
				<DropdownMenu placement="bottom-start">
					<DropdownMenuTrigger
						as="button"
						type="button"
						class="flex flex-row items-center gap-3 text-left hover:opacity-80 cursor-pointer w-fit aria-expanded:[&>svg]:rotate-180"
					>
						<h2 class="m-0 text-xl">{community().community.name}</h2>
						<CaretDownIcon class="text-muted-foreground mt-0.5 text-sm " />
					</DropdownMenuTrigger>
					<DropdownMenuPortal>
						<DropdownMenuContent class="min-w-48">
							<DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
								Settings
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={() => {
									setSettingsOpen(true);
								}}
							>
								Invite Links
							</DropdownMenuItem>
							<DropdownMenuItem
								class="text-destructive data-highlighted:text-destructive"
								onSelect={() => setLeaveOpen(true)}
							>
								Leave Community
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenuPortal>
				</DropdownMenu>
				<Suspense
					fallback={
						<small class="text-muted-foreground animate-pulse">
							Loading members...
						</small>
					}
				>
					<small class="text-muted-foreground">
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
		<CommunityLayout>{props.children}</CommunityLayout>
	</CommunityContextProvider>
);

export default CommunityLayoutWithContext;
