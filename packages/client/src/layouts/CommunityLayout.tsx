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
// import { CommunitySettingsModal } from "../components/Community/CommunitySettingsModal";
// import { InviteLinkCreationModal } from "../components/Community/InviteLinkCreationModal";
// import { LeaveCommunityModal } from "../components/Community/LeaveCommunityModal";
import { MessageInput } from "../components/app/community/MessageInput";
import User from "../components/app/user";
import {
	FileField,
	FileFieldDropzone,
	FileFieldHiddenInput,
} from "../components/ui/FileField";
import {
	CommunityContextProvider,
	useCommunityContext,
} from "../contexts/Community";
import { MemberSidebar } from "../components/app/community/MemberSidebar";

/**
 * Member list skeleton shown while the member roster is loading.
 */
const MemberListSkeleton = () => (
	<div class="w-full flex flex-col gap-2">
		<For each={[0, 1, 2, 3]}>
			{() => (
				<div class="flex flex-row gap-2 border border-border bg-card rounded-sm p-2 items-center">
					<div class="w-7 h-7 min-w-7 min-h-7 rounded-full bg-muted animate-pulse" />
					<div class="h-3 w-24 rounded-sm bg-muted animate-pulse" />
				</div>
			)}
		</For>
	</div>
);

const CommunityLayout: ParentComponent = (props) => {
	const params = useParams();
	const community = useCommunityContext();
	const [files, setFiles] = createSignal<Details>();

	const displayMembersAsSheet = createMediaQuery("(max-width: 1280px)");

	let hiddenInput: HTMLInputElement | undefined;

	// createEffect(() => {
	// 	const c = community();
	// 	if (!c) return;
	//  // TODO: Proper socket connection
	// 	sendSocketMessage({
	// 		action: "subscribe",
	// 		event_type: "community",
	// 		community_uri: `at://${c.owner_did}/social.colibri.community/${c.rkey}`,
	// 	});
	// });

	// onCleanup(() => {
	// 	const c = untrack(community);
	// 	if (!c) return;
	//  // TODO: Proper socket connection
	// 	sendSocketMessage({
	// 		action: "unsubscribe",
	// 		event_type: "community",
	// 		community_uri: `at://${c.owner_did}/social.colibri.community/${c.rkey}`,
	// 	});
	// });

	return (
		<div class="bg-background w-full h-full rounded-tl-xl border-t border-l border-border flex relative overflow-hidden">
			<aside class="h-full min-w-72 w-72 border-r border-border flex flex-col">
				<div class="w-full border-b border-border flex flex-col justify-center p-4">
					<h2 class="m-0 text-xl">{community().community.name}</h2>
					<div class="flex flex-row items-center gap-2 test-sm">
						<Suspense
							fallback={
								<small class="text-muted-foreground animate-pulse">
									Loading members...
								</small>
							}
						>
							<small>
								{community().members.length ?? "???"} Member
								{community().members.length === 1 ? "" : "s"}
							</small>
						</Suspense>
						{/* TODO: Proper permission checks & better Discord-style UI */}
						{/*<Show when={community()?.owner_did === globalContext.user.sub}>
							<div class="w-1 h-1 bg-muted-foreground rounded-full" />
							<CommunitySettingsModal>
								<small class="cursor-pointer hover:underline">Settings</small>
							</CommunitySettingsModal>
						</Show>
						<Show when={community()?.owner_did === globalContext.user.sub}>
							<div class="w-1 h-1 bg-muted-foreground rounded-full" />
							<InviteLinkCreationModal community={community()!.rkey}>
								<small class="cursor-pointer hover:underline">
									Invite Link
								</small>
							</InviteLinkCreationModal>
							</Show>
						<Show when={community()?.owner_did !== globalContext.user.sub}>
							<div class="w-1 h-1 bg-muted-foreground rounded-full" />
							<LeaveCommunityModal
								ownerDID={community()!.owner_did}
								community={community()!.rkey}
							>
								<small class="cursor-pointer hover:underline">
									Leave Community
								</small>
							</LeaveCommunityModal>
						</Show>*/}
					</div>
				</div>

				<ChannelList />

				<User.Status />
			</aside>
			{/*TODO: Make toggleable again*/}
			<div
				class="w-full h-full flex flex-col max-h-[calc(100vh-41px)]"
				classList={{
					"max-w-[calc(100vw-576px-56px-1px)]": !displayMembersAsSheet(),
					"max-w-[calc(100vw-288px-56px-1px)]": displayMembersAsSheet(),
				}}
			>
				{/* TODO: This file field really shouldn't be here, it should be in the channel context, which is part of the children of this. Same for message input */}
				{/*<FileField
					class="gap-0!"
					multiple
					onFileReject={(data) =>
						toast.error(`Failed to add file.`, {
							description: data
								.map((x) => x.errors.map((y) => y).join(", "))
								.join(", "),
						})
					}
					onFileChange={setFiles}
				>
					<FileFieldDropzone class="border-none gap-0!">
						<div
							class="contents"
							onClick={(e) => e.stopPropagation()}
							onKeyDown={(e) => e.stopPropagation()}
						>
							<div class="w-full flex-1 min-h-0">{props.children}</div>
							<Show
								when={
									(!!params.channel &&
										channel().type === "text" &&
										!channel()?.owner_only) ||
									(channel()?.owner_only &&
										globalContext.user.sub === community()?.owner_did)
								}
							>
								<MessageInput channelName={channel().name} files={files} />
							</Show>
						</div>
					</FileFieldDropzone>
					<FileFieldHiddenInput ref={hiddenInput} />
				</FileField>*/}
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
