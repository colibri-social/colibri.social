import { APPVIEW_DOMAIN } from "astro:env/client";
import { createAsync, query } from "@solidjs/router";
import { useParams } from "@solidjs/router";
import {
	createEffect,
	createMemo,
	For,
	Match,
	onCleanup,
	type ParentComponent,
	Show,
	Suspense,
	Switch,
	untrack,
} from "solid-js";
import type { SidebarData } from "@/utils/sdk";
import { ChannelList } from "../components/Community/ChannelList";
import { MessageInput } from "../components/MessageInput";
import { UserStatus } from "../components/UserStatus";
import { ChannelContextProvider } from "../contexts/ChannelContext";
import { useGlobalContext } from "../contexts/GlobalContext/index";
import { MessageContextProvider } from "../contexts/MessageContext";
import { CommunitySettingsModal } from "../components/Community/CommunitySettingsModal";

/**../components/Community/CommunitySettingsModal
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

type MemberData = {
	member_did: string;
	status: "owner" | string;
	display_name: string;
	avatar_url: string;
};

/**
 * Fetches the member list for a community from the appview.
 * Keyed by owner DID + community rkey so different communities cache separately.
 */
export const fetchCommunityMembers = query(
	async (ownerDid: string, community: string): Promise<Array<MemberData>> => {
		const response = await fetch(
			`https://${APPVIEW_DOMAIN}/api/members?community=${encodeURIComponent(
				`at://${ownerDid}/social.colibri.community/${community}`,
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
	const [globalContext, { sendSocketMessage }] = useGlobalContext();

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
				})) ?? [];

		const removedRkeys = new Set(
			globalContext.removedChannels
				.filter((ch) => ch.community === community)
				.map((ch) => ch.rkey),
		);

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

	return (
		<MessageContextProvider>
			<ChannelContextProvider channels={channels} community={communityRkey}>
				<div class="bg-background w-full h-full rounded-tl-xl border-t border-l border-border flex">
					<Suspense
						fallback={
							<div class="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
								Loading community...
							</div>
						}
					>
						<Switch
							fallback={
								<div class="w-full h-full flex items-center justify-center">
									<p class="text-destructive">Failed to load community data.</p>
								</div>
							}
						>
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
													{members()?.length ?? "???"} Member
													{members()?.length === 1 ? "" : "s"}
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
										</div>
									</div>

									<ChannelList
										data={sidebarData()!}
										community={params.community!}
									/>

									<UserStatus />
								</aside>
								<div class="w-full h-full flex flex-col max-h-[calc(100vh-39px)] max-w-[calc(100vw-576px-56px-1px)]">
									<div class="w-full flex-1 min-h-0">{props.children}</div>
									<Show when={!!params.channel}>
										<MessageInput />
									</Show>
								</div>
								<div class="min-w-72 w-72 h-full flex flex-col p-4 border-l gap-3 border-border overflow-y-auto">
									<span>Members</span>
									<Suspense fallback={<MemberListSkeleton />}>
										<For each={members() ?? []}>
											{(item) => (
												<div class="flex flex-row gap-2 border border-border bg-card rounded-sm p-2">
													<img
														src={item.avatar_url}
														alt={item.display_name}
														width={28}
														height={28}
														class="rounded-full"
													/>
													<span class="font-medium">{item.display_name}</span>
												</div>
											)}
										</For>
									</Suspense>
								</div>
							</Match>
						</Switch>
					</Suspense>
				</div>
			</ChannelContextProvider>
		</MessageContextProvider>
	);
};

export default CommunityLayout;
