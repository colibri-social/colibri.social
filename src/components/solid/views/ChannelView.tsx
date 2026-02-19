import { useParams } from "@solidjs/router";
import {
	type Component,
	createEffect,
	createResource,
	createSignal,
	For,
	Match,
	onMount,
	Suspense,
	Switch,
} from "solid-js";
import type { ChannelInfo } from "@/pages/api/v1/channel/[channel]/messages";
import type { MaybeResponse } from "@/utils/types/maybe-response";
import { Message } from "../components/Message";
import {
	makeHeartbeatWS,
	makeReconnectingWS,
} from "@solid-primitives/websocket";
import type { MessageData } from "@/utils/sdk";

// import { useGlobalContext } from "../contexts/GlobalContext";

type JetstreamData = {
	did: string;
	time_us: number;
	kind: "commit" | "account" | "identity";
};

type JetstreamMessageCommit = JetstreamData & {
	kind: "commit";
	commit: {
		rev: string;
		operation: string;
		collection: "social.colibri.message";
		rkey: string;
		record: {
			$type: "social.colibri.message";
			channel: string;
			createdAt: string;
			text: string;
		};
		cid: string;
	};
};

const fetchMessagesForChannel = async (
	channel: string,
): Promise<MaybeResponse<ChannelInfo>> => {
	const response = await fetch(`/api/v1/channel/${channel}/messages`);
	return response.json();
};

const ChannelView: Component = () => {
	const params = useParams();
	let chatContainer: HTMLDivElement | undefined;

	const [messages] = createResource(
		() => params.channel,
		fetchMessagesForChannel,
	);

	const [additionalMessages, setAdditionalMessages] = createSignal<
		Array<MessageData>
	>([]);

	// TODO: Move jetstream consumer to appview, socket connection to appview to applayout, distribute messages from there.
	// We need this for message indicators as well as notifications anyway.
	const socket = makeHeartbeatWS(
		makeReconnectingWS(
			`wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=social.colibri.message`,
		),
	);

	socket.addEventListener("message", (message) => {
		const data = JSON.parse(message.data) as JetstreamData;

		if (data.kind !== "commit") return;

		const commitData = (data as JetstreamMessageCommit).commit;

		if (commitData.record.channel !== params.channel) return;

		setAdditionalMessages((current) => [
			...current,
			{
				channel: commitData.record.channel,
				createdAt: commitData.record.createdAt,
				rkey: commitData.rkey,
				text: commitData.record.text,
			},
		]);
	});

	createEffect(() => {
		// Wait until both initial messages and additionalMessages are ready
		const msgs = messages()?.data?.messages ?? [];
		const additional = additionalMessages();

		if (!chatContainer || (msgs.length === 0 && additional.length === 0))
			return;

		// Schedule scroll after DOM updates
		requestAnimationFrame(() => {
			chatContainer!.scrollTop = chatContainer!.scrollHeight;
		});
	});

	return (
		<div
			class="w-full h-full overflow-auto"
			style={{ height: "calc(100vh - 40px - 64px)" }}
			ref={chatContainer}
		>
			<Suspense fallback={<div>Loading...</div>}>
				<Switch>
					<Match when={messages.error || messages()?.error !== null}>
						<div>Lol nope</div>
					</Match>
					<Match when={messages()?.error === null}>
						<For
							each={[
								...messages()!.data!.messages.sort(
									(a, b) =>
										new Date(a.createdAt).getTime() -
										new Date(b.createdAt).getTime(),
								),
								...additionalMessages(),
							]}
						>
							{(item) => <Message data={item} />}
						</For>
					</Match>
				</Switch>
			</Suspense>
		</div>
	);
};

export default ChannelView;
