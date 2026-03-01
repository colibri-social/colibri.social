import { useParams } from "@solidjs/router";
import {
	createMemo,
	createResource,
	For,
	Match,
	type ParentComponent,
	Suspense,
	Switch,
} from "solid-js";
import type { CommunityInfo } from "@/pages/api/v1/community/[community]";
import type { MaybeResponse } from "@/utils/types/maybe-response";
import { ChannelList } from "../components/Community/ChannelList";
import { MessageInput } from "../components/MessageInput";
import { UserStatus } from "../components/UserStatus";
import { ChannelContextProvider } from "../contexts/ChannelContext";
import { useGlobalContext } from "../contexts/GlobalContext";
import { MessageContextProvider } from "../contexts/MessageContext";
import { APPVIEW_DOMAIN } from "astro:env/client";

/**
 * A fetch wrapper to return all categories and channels for a community.
 * @param community The community to fetch the data for.
 * @returns The fetched data as JSON.
 * @todo Move to Astro Action
 */
const fetchCommunityCategoriesAndChannels = async (
	community: string,
): Promise<MaybeResponse<CommunityInfo>> => {
	const response = await fetch(`/api/v1/community/${community}`);
	return response.json();
};

type MemberData = {
	member_did: string;
	status: "owner" | string;
	display_name: string;
	avatar_url: string;
};

/**
 * A fetch wrapper to return all categories and channels for a community.
 * @param ownerDid The DID of the owner.
 * @param community The community to fetch the data for.
 * @returns The fetched data as JSON.
 * @todo Move to Astro Action
 */
const fetchCommunityMembers = async (
	ownerDid: string,
	community: string,
): Promise<Array<MemberData>> => {
	const response = await fetch(
		`https://${APPVIEW_DOMAIN}/api/members?community=${encodeURIComponent(`at://${ownerDid}/social.colibri.community/${community}`)}`,
	);
	return response.json();
};

const CommunityLayout: ParentComponent = (props) => {
	const params = useParams();
	const [globalContext] = useGlobalContext();

	const community = createMemo(() =>
		globalContext.communities.find((x) => x.rkey === params.community),
	);

	const [communityInfo] = createResource(
		() => params.community,
		fetchCommunityCategoriesAndChannels,
	);

	const [members] = createResource(
		() => {
			const c = community();
			const rkey = params.community;
			if (!c?.owner_did || !rkey) return null;
			return { ownerDid: c.owner_did, community: rkey };
		},
		(source) => fetchCommunityMembers(source.ownerDid, source.community),
	);

	const channels = createMemo(() => communityInfo()?.data?.channels ?? []);
	const communityRkey = createMemo(() => params.community ?? "");

	return (
		<MessageContextProvider>
			<ChannelContextProvider channels={channels} community={communityRkey}>
				<div class="bg-background w-full h-full rounded-tl-xl border-t border-l border-border flex">
					<Suspense fallback={<div>Loading...</div>}>
						<Switch>
							<Match
								when={communityInfo.error || communityInfo()?.error !== null}
							>
								<div>Lol nope</div>
							</Match>
							<Match when={communityInfo()?.error === null}>
								<aside class="h-full min-w-72 w-72 border-r border-border flex flex-col">
									<div class="w-full border-b border-border flex flex-col justify-center p-4">
										<h2 class="m-0 text-xl">{community()?.name}</h2>
										<small>
											{members()?.length || "???"} Member
											{members()?.length === 1 ? "" : "s"}
										</small>
									</div>
									<ChannelList
										data={communityInfo()!.data!}
										community={params.community!}
									/>
									<UserStatus />
								</aside>
								<div class="w-full h-full flex flex-col max-h-[calc(100vh-39px)] max-w-[calc(100vw-576px-56px-1px)]">
									<div class="w-full flex-1 min-h-0">{props.children}</div>
									<MessageInput />
								</div>
								<div class="min-w-72 w-72 h-full flex flex-col p-4 border-l gap-3 border-border">
									<span>Members</span>
									<div class="w-full flex flex-col gap-2">
										<For each={members() || []}>
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
									</div>
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
