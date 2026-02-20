import { APPVIEW_DOMAIN } from "astro:env/client";
import { createAsync, query, useParams } from "@solidjs/router";
import {
	type Component,
	createEffect,
	For,
	onCleanup,
	Suspense,
} from "solid-js";
import type { IndexedMessageData } from "@/utils/sdk";
import { Message } from "../components/Message";
import {
	type PendingMessageData,
	useGlobalContext,
} from "../contexts/GlobalContext";

// import { useGlobalContext } from "../contexts/GlobalContext";

// TODO: this only fetches the last 50 messages. The appview supports paging (we can implement this via observers)
// but it's still a work in progress thing.
const fetchMessagesForChannel = query(
	async (channel: string): Promise<Array<IndexedMessageData>> => {
		const response = await fetch(
			`https://${APPVIEW_DOMAIN}/api/messages?channel=${channel}`,
		);
		return response.json();
	},
	"messages",
);

const ChannelView: Component = () => {
	const params = useParams();
	const [globalState, { sendSocketMessage }] = useGlobalContext();
	const messages = createAsync(() => fetchMessagesForChannel(params.channel!));

	let chatContainer: HTMLDivElement | undefined;

	createEffect(() => {
		sendSocketMessage({
			action: "subscribe",
			event_type: "message",
			channel: params.channel,
		});
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

	onCleanup(() => {
		sendSocketMessage({
			action: "unsubscribe",
			event_type: "message",
			channel: params.channel,
		});
	});

	const allMessages = () => {
		const fetchedMessageData = messages() || [];
		const newlyReceivedMessages = globalState.additionalMessages;
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
