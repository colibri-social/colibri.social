import {
	makeHeartbeatWS,
	makeReconnectingWS,
} from "@solid-primitives/websocket";
import { createAsync, query, useParams } from "@solidjs/router";
import {
	type Component,
	createEffect,
	createSignal,
	For,
	Match,
	onCleanup,
	Suspense,
} from "solid-js";
import { generateHash } from "@/utils/generate-hash";
import type { IndexedMessageData } from "@/utils/sdk";
import { Message } from "../components/Message";
import {
	useGlobalContext,
	type PendingMessageData,
} from "../contexts/GlobalContext";

// import { useGlobalContext } from "../contexts/GlobalContext";

type AppviewSubscriptionData = {
	type: "message";
	id: string;
	rkey: string;
	author_did: string;
	text: string;
	channel: string;
	created_at: string;
	indexed_at: string;
	display_name: string;
	avatar_url: string;
};

// TODO: this only fetches the last 50 messages. The appview supports paging (we can implement this via observers)
// but it's still a work in progress thing.
const fetchMessagesForChannel = query(
	async (channel: string): Promise<Array<IndexedMessageData>> => {
		const response = await fetch(
			`https://appview.colibri.social/api/messages?channel=${channel}`,
		);
		return response.json();
	},
	"messages",
);

const ChannelView: Component = () => {
	const params = useParams();
	let chatContainer: HTMLDivElement | undefined;

	const [globalState, { removePendingMessage }] = useGlobalContext();

	const messages = createAsync(() => fetchMessagesForChannel(params.channel!));

	const [additionalMessages, setAdditionalMessages] = createSignal<
		Array<IndexedMessageData>
	>([]);

	// TODO: Move jetstream consumer to appview, socket connection to appview to applayout, distribute messages from there.
	// We need this for message indicators as well as notifications anyway.
	const socket = makeHeartbeatWS(
		makeReconnectingWS(`wss://appview.colibri.social/api/subscribe`),
		{
			message: JSON.stringify({ action: "heartbeat", event_type: "heartbeat" }),
			interval: 20_000,
		},
	);

	socket.addEventListener("open", () => {
		socket.send(
			JSON.stringify({
				action: "subscribe",
				event_type: "message",
				channel: params.channel,
			}),
		);
	});

	socket.addEventListener("message", async (message) => {
		const data = JSON.parse(message.data) as AppviewSubscriptionData;

		if (data.type !== "message") return;

		const hash = await generateHash(
			JSON.stringify({
				text: data.text,
				channel: data.channel,
				createdAt: data.created_at,
			}),
		);

		removePendingMessage(hash);

		setAdditionalMessages((current) => [
			...current,
			{
				channel: data.channel,
				created_at: data.created_at,
				rkey: data.rkey,
				text: data.text,
				author_did: data.author_did,
				display_name: data.display_name!,
				avatar_url: data.avatar_url!,
			},
		]);
	});

	createEffect(() => {
		// Wait until both initial messages and additionalMessages are ready
		const msgs = allMessages();

		if (!chatContainer || msgs.length === 0) return;

		// Schedule scroll after DOM updates
		requestAnimationFrame(() => {
			chatContainer!.scrollTop = chatContainer!.scrollHeight;
		});
	});

	const allMessages = () => {
		const fetchedMessageData = messages() || [];
		const newlyReceivedMessages = additionalMessages();
		const pendingMessages = globalState.pendingMessages;

		return [...fetchedMessageData, ...newlyReceivedMessages, ...pendingMessages]
			.filter((message) => message.channel === params.channel)
			.sort((a, b) => {
				let dateA: number;
				let dateB: number;

				if ("hash" in a) dateA = new Date(a.createdAt).getTime();
				else dateA = new Date(a.created_at).getTime();

				if ("hash" in b) dateB = new Date(b.createdAt).getTime();
				else dateB = new Date(b.created_at).getTime();

				return dateA - dateB;
			});
	};

	onCleanup(() => {
		socket.send(
			JSON.stringify({
				action: "unsubscribe",
				event_type: "message",
				channel: params.channel,
			}),
		);
		socket.close();
	});

	createEffect(() => {
		// Track params.channel
		const _channel = params.channel;

		// Reset the signal whenever the channel changes
		setAdditionalMessages([]);
	});

	return (
		<div
			class="w-full h-full overflow-auto pb-4"
			style={{ height: "calc(100vh - 40px - 64px)" }}
			ref={chatContainer}
		>
			<Suspense fallback={<div></div>}>
				<div class="w-full flex flex-col justify-center items-center">
					<h3 class="mb-0">This is the start of this channel.</h3>
					<p>Send some messages to get the discussion started!</p>
				</div>
				<For each={allMessages()}>
					{(item, index) => {
						const idx = index();
						const messageList = allMessages();

						const subsequentMessage =
							idx !== 0 && messageList[idx - 1].author_did === item.author_did;

						return (
							<Message
								isSubsequent={subsequentMessage}
								data={item as PendingMessageData | IndexedMessageData}
							/>
						);
					}}
				</For>
			</Suspense>
		</div>
	);
};

export default ChannelView;
