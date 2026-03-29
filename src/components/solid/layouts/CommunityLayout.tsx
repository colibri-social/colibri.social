import { APPVIEW_DOMAIN } from "astro:env/client";
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
import { RECORD_IDs } from "@/utils/atproto/lexicons";
import createMediaQuery from "@/utils/create-media-query";
import { ensureUserStateCached } from "@/utils/ensure-user-state-cached";
import type { SidebarData } from "@/utils/sdk";
import { ChannelList } from "../components/Community/ChannelList";
import { CommunitySettingsModal } from "../components/Community/CommunitySettingsModal";
import { InviteLinkCreationModal } from "../components/Community/InviteLinkCreationModal";
import { LeaveCommunityModal } from "../components/Community/LeaveCommunityModal";
import { MemberProfilePopover } from "../components/MemberProfilePopover";
import { MessageInput } from "../components/MessageInput";
import { UserStatus } from "../components/UserStatus";
import { ChannelContextProvider } from "../contexts/ChannelContext";
import { CommunityContextProvider } from "../contexts/CommunityContext";
import type { UserOnlineState } from "../contexts/GlobalContext/events";
import { useGlobalContext } from "../contexts/GlobalContext/index";
import { MessageContextProvider } from "../contexts/MessageContext";
import {
	FileField,
	FileFieldDropzone,
	FileFieldHiddenInput,
} from "../shadcn-solid/file-field";
import User from '../components/User'

/**
 * Fetches the sidebar data (categories + channels) for a community.
 */
export const fetchSidebarData = query(
	async (ownerDid: string, communityRkey: string): Promise<SidebarData> => {
		const uri = encodeURIComponent(
			`at://${ownerDid}/social.colibri.community/${communityRkey}`,
		);
		const response = await fetch(
			`https://${APPVIEW_DOMAIN}/api/sidebar?community=${uri}`,
		);
		return response.json();
	},
	"sidebarData",
);

export type MemberData = {
	member_did: string;
	status: "owner" | string;
	display_name: string;
	avatar_url: string;
	status_text?: string;
	emoji?: string;
	banner_url?: string;
	handle?: string;
	description?: string;
	state?: UserOnlineState;
};

/**
 * Fetches the member list for a community from the appview.
 * Keyed by owner DID + community rkey so different communities cache separately.
 */
export const fetchCommunityMembers = query(
	async (ownerDid: string, community: string): Promise<Array<MemberData>> => {
		const response = await fetch(
			`https://${APPVIEW_DOMAIN}/api/members?community=${encodeURIComponent(
				`at://${ownerDid}/${RECORD_IDs.COMMUNITY}/${community}`,
			)}`,
		);
		return response.json();
	},
	"communityMembers",
);

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
	const [globalContext, { sendSocketMessage, updateUserOnlineState }] =
		useGlobalContext();
	const [files, setFiles] = createSignal<Details>();

	const displayMembersAsSheet = createMediaQuery("(max-width: 1280px)");

	let hiddenInput: HTMLInputElement | undefined;

	const community = createMemo(() =>
		globalContext.communities.find((x) => x.rkey === params.community),
	);

	/**
	 * Fetches sidebar data (categories + channels) for the current community
	 * directly from the appview. Re-runs only when params.community changes.
	 *
	 * IMPORTANT: community() is read with untrack() here for the same reason
	 * as the members fetch below.
	 */
	const sidebarData = createAsync(
		() => {
			const rkey = params.community;
			const ownerDid = untrack(() => community()?.owner_did);
			if (!ownerDid || !rkey) return Promise.resolve(null);
			return fetchSidebarData(ownerDid, rkey);
		},
		{ name: "sidebarData" },
	);

	/**
	 * Fetches the member list for the current community.
	 *
	 * IMPORTANT: community() is read with untrack() here. Without it, this
	 * createAsync re-runs every time anything in globalContext changes (incoming
	 * WebSocket messages, pending messages, reactions, etc.) because community()
	 * reads from the reactive globalContext store. That caused an infinite fetch
	 * loop and OOM crashes.
	 */
	const members = createAsync(
		() => {
			const rkey = params.community;
			const ownerDid = untrack(() => community()?.owner_did);

			if (!ownerDid || !rkey) return Promise.resolve([] as Array<MemberData>);

			return fetchCommunityMembers(ownerDid, rkey);
		},
		{ name: "communityMembers", initialValue: [] as Array<MemberData> },
	);

	const combinedMemberList = createMemo(() => {
		const serverMemberList = members();
		const optimisticJoinList = globalContext.joinedMembers;
		const optimisticRemovedList = globalContext.removedMembers;

		const totalCurrentlyJoined = [...serverMemberList, ...optimisticJoinList];

		return totalCurrentlyJoined
			.filter(
				(x) =>
					!optimisticRemovedList.some((y) => y.member_did === x.member_did),
			)
			.filter((x) => {
				if (community()?.requires_approval_to_join) {
					return x.status !== "pending";
				}

				return true;
			})
			.sort((a, b) =>
				(a.display_name ?? a.handle ?? a.member_did)?.localeCompare(
					b.display_name ?? b.handle ?? b.member_did,
				),
			);
	});

	const membersWithOptimisticUpdates = createMemo(() => {
		const combinedMembers = combinedMemberList();
		const statusOverrides = globalContext.memberStatusOverrides;
		const profileOverrides = globalContext.memberProfileOverrides;

		return combinedMembers.map((member) => {
			const optimisticStatusUpdate = statusOverrides.find(
				(x) => x.did === member.member_did,
			);

			const optimisticProfileUpdate = profileOverrides.find(
				(x) => x.did === member.member_did,
			);

			return {
				member_did: member.member_did,
				status: member.status,
				avatar_url: optimisticProfileUpdate?.avatar_url || member.avatar_url,
				display_name:
					optimisticProfileUpdate?.display_name || member.display_name,
				banner_url: optimisticProfileUpdate?.banner_url || member.banner_url,
				description: optimisticProfileUpdate?.description || member.description,
				emoji: optimisticStatusUpdate?.emoji || member.emoji,
				handle: optimisticProfileUpdate?.handle || member.handle,
				status_text: optimisticStatusUpdate?.status || member.status_text,
			} as MemberData;
		});
	});

	createEffect(() => {
		const c = community();
		if (!c) return;

		sendSocketMessage({
			action: "subscribe",
			event_type: "community",
			community_uri: `at://${c.owner_did}/social.colibri.community/${c.rkey}`,
		});
	});

	onCleanup(() => {
		const c = untrack(community);
		if (!c) return;

		sendSocketMessage({
			action: "unsubscribe",
			event_type: "community",
			community_uri: `at://${c.owner_did}/social.colibri.community/${c.rkey}`,
		});
	});

	const communityRkey = createMemo(() => params.community ?? "");

	/**
	 * Flat list of all channels in the current community, derived from the
	 * sidebar data, with any matching entries overwritten by the global context
	 * (optimistic updates), and net-new global context channels appended.
	 * Used by ChannelContext so the RichTextRenderer can offer channel mention
	 * autocomplete.
	 */
	const channels = createMemo(() => {
		const sidebar = sidebarData();
		const community = communityRkey();

		const fromSidebar =
			sidebar?.categories
				.flatMap((c) => c.channels)
				.concat(sidebar?.uncategorized ?? [])
				.map((ch) => ({
					rkey: ch.rkey,
					name: ch.name,
					type: ch.channel_type,
					category: ch.category_rkey ?? "",
					community,
					owner_only: ch.owner_only,
				})) ?? [];

		const removedRkeys = new Set(globalContext.removedChannels);

		const globalForCommunity = globalContext.addedChannels.filter(
			(ch) => ch.community === community,
		);
		const globalByRkey = new Map(globalForCommunity.map((ch) => [ch.rkey, ch]));

		const merged = fromSidebar
			.filter((ch) => !removedRkeys.has(ch.rkey))
			.map((ch) => globalByRkey.get(ch.rkey) ?? ch);

		const sidebarRkeys = new Set(fromSidebar.map((ch) => ch.rkey));
		const netNew = globalForCommunity.filter(
			(ch) => !sidebarRkeys.has(ch.rkey) && !removedRkeys.has(ch.rkey),
		);

		return [...merged, ...netNew];
	});

	const channel = () => channels().find((x) => x.rkey === params.channel)!;

	const owner = () =>
		membersWithOptimisticUpdates().find(
			(x) => x.member_did === community()?.owner_did,
		) || ({} as MemberData);

	const ownerState = () =>
		globalContext.userOnlineStates.find((x) => x.did === community()?.owner_did)
			?.state || "offline";

	const nonOwnerMembers = () =>
		membersWithOptimisticUpdates()?.filter(
			(x) => x.member_did !== community()?.owner_did,
		) ?? [];

	return (
		<MessageContextProvider>
			<CommunityContextProvider
				owner={() => community()!.owner_did}
				rkey={() => community()!.rkey}
				members={membersWithOptimisticUpdates}
				sidebar={sidebarData}
				requiresApprovalToJoin={() => community()!.requires_approval_to_join}
			>
				<ChannelContextProvider channels={channels} community={communityRkey}>
					<div class="bg-background w-full h-full rounded-tl-xl border-t border-l border-border flex relative overflow-hidden">
						<Switch>
							<Match when={sidebarData()}>
								<aside class="h-full min-w-72 w-72 border-r border-border flex flex-col">
									<div class="w-full border-b border-border flex flex-col justify-center p-4">
										<h2 class="m-0 text-xl">{community()?.name}</h2>
										<div class="flex flex-row items-center gap-2 test-sm">
											<Suspense
												fallback={
													<small class="text-muted-foreground animate-pulse">
														Loading members...
													</small>
												}
											>
												<small>
													{combinedMemberList()?.length ?? "???"} Member
													{combinedMemberList()?.length === 1 ? "" : "s"}
												</small>
											</Suspense>
											<Show
												when={community()?.owner_did === globalContext.user.sub}
											>
												<div class="w-1 h-1 bg-muted-foreground rounded-full" />
												<CommunitySettingsModal>
													<small class="cursor-pointer hover:underline">
														Settings
													</small>
												</CommunitySettingsModal>
											</Show>
											<Show
												when={community()?.owner_did === globalContext.user.sub}
											>
												<div class="w-1 h-1 bg-muted-foreground rounded-full" />
												<InviteLinkCreationModal community={community()!.rkey}>
													<small class="cursor-pointer hover:underline">
														Invite Link
													</small>
												</InviteLinkCreationModal>
											</Show>
											<Show
												when={community()?.owner_did !== globalContext.user.sub}
											>
												<div class="w-1 h-1 bg-muted-foreground rounded-full" />
												<LeaveCommunityModal
													ownerDID={community()!.owner_did}
													community={community()!.rkey}
												>
													<small class="cursor-pointer hover:underline">
														Leave Community
													</small>
												</LeaveCommunityModal>
											</Show>
										</div>
									</div>

									<ChannelList
										data={sidebarData()!}
										community={params.community!}
										categoryOrder={community()?.category_order || []}
									/>

									<UserStatus />
								</aside>
								<div
									class="w-full h-full flex flex-col max-h-[calc(100vh-41px)]"
									classList={{
										"max-w-[calc(100vw-576px-56px-1px)]":
											!displayMembersAsSheet() &&
											globalContext.uiStates.membersListVisible,
										"max-w-[calc(100vw-288px-56px-1px)]":
											displayMembersAsSheet() ||
											!globalContext.uiStates.membersListVisible,
									}}
								>
									<FileField
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
												<div class="w-full flex-1 min-h-0">
													{props.children}
												</div>
												<Show
													when={
														(!!params.channel &&
															channel().type === "text" &&
															!channel()?.owner_only) ||
														(channel()?.owner_only &&
															globalContext.user.sub === community()?.owner_did)
													}
												>
													<MessageInput
														channelName={channel().name}
														files={files}
													/>
												</Show>
											</div>
										</FileFieldDropzone>
										<FileFieldHiddenInput ref={hiddenInput} />
									</FileField>
								</div>
								<div
									class="min-w-72 flex w-72 h-full flex-col p-4 border-l gap-3 border-border overflow-y-auto bg-background"
									classList={{
										"absolute top-0 right-0 h-full drop-shadow-black drop-shadow-2xl":
											displayMembersAsSheet(),
										hidden: !globalContext.uiStates.membersListVisible,
									}}
								>
									<span>Owner</span>
									<MemberProfilePopover
										banner={owner().banner_url}
										avatar={owner().avatar_url}
										description={owner().description}
										displayName={owner().display_name}
										emoji={owner().emoji}
										handle={owner().handle}
										status={owner().state}
										did={owner().member_did}
										class="data-expanded:[&>div]:bg-muted!"
									>
										<div class="flex flex-row gap-2 rounded-sm px-2 py-1 hover:bg-card items-center cursor-pointer h-12 flex-1">
											<User.Avatar user={owner()} state={ownerState()} />
											<div class="flex flex-col w-[calc(100%-36px-8px)]">
												<span class="font-medium leading-5 overflow-hidden text-ellipsis">
													{owner().display_name || owner().handle}
												</span>
												<Show
													when={
														owner().status_text && owner().state !== "offline"
													}
												>
													<span class="text-sm w-full leading-5 flex flex-row items-center gap-2">
														<Show when={owner().emoji}>
															<span
																class="[&>img]:min-w-4 [&>img]:min-h-4 [&>img]:w-4 [&>img]:h-4 [&>img]inline"
																innerHTML={twemoji.parse(owner().emoji!)}
															/>
														</Show>
														<span class="w-full overflow-hidden text-ellipsis whitespace-nowrap">
															{owner().status_text}
														</span>
													</span>
												</Show>
											</div>
										</div>
									</MemberProfilePopover>
									<span>Members</span>
									<div
										class="flex flex-col w-full gap-1"
										style={{
											height: `${nonOwnerMembers().length * 48 + (nonOwnerMembers().length - 1) * 4}px`,
										}}
									>
										<Suspense fallback={<MemberListSkeleton />}>
											<For each={nonOwnerMembers()}>
												{(item) => {
													ensureUserStateCached(
														item.member_did,
														item.state || "offline",
														globalContext,
														updateUserOnlineState,
													);

													const state = () =>
														globalContext.userOnlineStates.find(
															(x) => x.did === item.member_did,
														)?.state || "offline";

													return (
														<MemberProfilePopover
															banner={item.banner_url}
															avatar={item.avatar_url}
															description={item.description}
															displayName={item.display_name}
															emoji={item.emoji}
															handle={item.handle}
															status={item.status_text}
															did={item.member_did}
															class="data-expanded:[&>div]:bg-muted!"
														>
															<div class="flex flex-row gap-2 rounded-sm px-2 py-1 hover:bg-card items-center cursor-pointer h-12 flex-1">
																<User.Avatar user={item} state={state()} />
																<div class="flex flex-col w-[calc(100%-36px-8px)]">
																	<span class="font-medium leading-5 overflow-hidden text-ellipsis">
																		{item.display_name || item.handle}
																	</span>
																	<Show
																		when={
																			item.status_text && state() !== "offline"
																		}
																	>
																		<span class="text-sm w-full leading-5 flex flex-row items-center gap-2">
																			<Show when={item.emoji}>
																				<span
																					class="[&>img]:min-w-4 [&>img]:min-h-4 [&>img]:w-4 [&>img]:h-4 [&>img]inline"
																					innerHTML={twemoji.parse(item.emoji!)}
																				/>
																			</Show>
																			<span class="w-full overflow-hidden text-ellipsis whitespace-nowrap">
																				{item.status_text}
																			</span>
																		</span>
																	</Show>
																</div>
															</div>
														</MemberProfilePopover>
													);
												}}
											</For>
										</Suspense>
									</div>
								</div>
							</Match>
						</Switch>
					</div>
				</ChannelContextProvider>
			</CommunityContextProvider>
		</MessageContextProvider>
	);
};

export default CommunityLayout;
