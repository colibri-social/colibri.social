import { useParams } from "@solidjs/router";
import {
	type Component,
	createResource,
	For,
	Match,
	Suspense,
	Switch,
} from "solid-js";
import type { ChannelInfo } from "@/pages/api/v1/channel/[channel]/messages";
import type { MaybeResponse } from "@/utils/types/maybe-response";
import { Message } from "../components/Message";

// import { useGlobalContext } from "../contexts/GlobalContext";

const fetchMessagesForChannel = async (
	channel: string,
): Promise<MaybeResponse<ChannelInfo>> => {
	const response = await fetch(`/api/v1/channel/${channel}/messages`);
	return response.json();
};

const ChannelView: Component = () => {
	const params = useParams();
	// const [globalContext] = useGlobalContext();

	const [messages] = createResource(
		() => params.channel,
		fetchMessagesForChannel,
	);

	return (
		<div class="w-full h-full flex flex-col justify-end">
			<Suspense fallback={<div>Loading...</div>}>
				<Switch>
					<Match when={messages.error || messages()?.error !== null}>
						<div>Lol nope</div>
					</Match>
					<Match when={messages()?.error === null}>
						<For each={messages()!.data!.messages.reverse()}>
							{(item) => <Message data={item} />}
						</For>
					</Match>
				</Switch>
			</Suspense>
		</div>
	);
};

export default ChannelView;
