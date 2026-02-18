import { useParams } from "@solidjs/router";
import {
	createResource,
	Match,
	type ParentComponent,
	Suspense,
	Switch,
} from "solid-js";
import type { CommunityInfo } from "@/pages/api/v1/community/[community]";
import type { MaybeResponse } from "@/utils/types/maybe-response";
import { ChannelList } from "../components/ChannelList";
import { MessageInput } from "../components/MessageInput";
import { UserStatus } from "../components/UserStatus";
import { useGlobalContext } from "../contexts/GlobalContext";

const fetchCommunityCategoriesAndChannels = async (
	community: string,
): Promise<MaybeResponse<CommunityInfo>> => {
	const response = await fetch(`/api/v1/community/${community}`);
	return response.json();
};

const CommunityLayout: ParentComponent = (props) => {
	const params = useParams();
	const [globalContext] = useGlobalContext();

	const community = globalContext().communities.find(
		(x) => x.rkey === params.community,
	);

	const [communityInfo] = createResource(
		params.community,
		fetchCommunityCategoriesAndChannels,
	);

	return (
		<div class="bg-neutral-950 w-full h-full rounded-tl-xl border-t border-l border-neutral-800 flex">
			<Suspense fallback={<div>Loading...</div>}>
				<Switch>
					<Match when={communityInfo.error || communityInfo()?.error !== null}>
						<div>Lol nope</div>
					</Match>
					<Match when={communityInfo()?.error === null}>
						<aside class="h-full min-w-72 w-72 border-r border-neutral-800 flex flex-col">
							<div class="w-full border-b border-neutral-800 flex flex-col justify-center p-4">
								<h2 class="m-0 text-xl">{community?.name}</h2>
								<small>69 Members</small>
							</div>
							<ChannelList data={communityInfo()!.data!} />
							<UserStatus />
						</aside>
						<div class="w-full h-full flex flex-col max-h-full relative">
							<div class="w-full h-full max-h-full">{props.children}</div>
							<MessageInput />
						</div>
						<div class="min-w-72 w-72 h-full flex flex-col p-4 border-l border-neutral-800">
							Members List
						</div>
					</Match>
				</Switch>
			</Suspense>
		</div>
	);
};

export default CommunityLayout;
