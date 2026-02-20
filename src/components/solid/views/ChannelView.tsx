import { APPVIEW_DOMAIN } from "astro:env/client";
import { createAsync, query, useParams } from "@solidjs/router";
import {
	type Component,
	createEffect,
	createSignal,
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
	const [
		globalState,
		{ sendSocketMessage, clearAdditionalMessages, clearDeletedMessages },
	] = useGlobalContext();
	const messages = createAsync(() => fetchMessagesForChannel(params.channel!));
	const [scrolled, setScrolled] = createSignal(false);

	let chatContainer: HTMLDivElement | undefined;

	onCleanup(() => {
		sendSocketMessage({
			action: "unsubscribe",
			event_type: "message",
			channel: params.channel,
		});

		clearAdditionalMessages();
		clearDeletedMessages();
	});

	const allMessages = () => {
		console.log("allMessages: ", globalState.deletedMessages);
		const fetchedMessageData = messages() || [];
		const newlyReceivedMessages = globalState.additionalMessages;
		const pendingMessages = globalState.pendingMessages;
		const deletedMessages = globalState.deletedMessages;

		return [...fetchedMessageData, ...newlyReceivedMessages, ...pendingMessages]
			.filter((message) => message.channel === params.channel)
			.filter((message) => {
				// Early return since pending messages cannot be deleted
				if ("hash" in message) return true;

				return !deletedMessages.find(
					(delMessage) =>
						message.author_did === delMessage.author_did &&
						message.channel === delMessage.channel &&
						message.rkey === delMessage.rkey,
				);
			})
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

	createEffect(() => {
		sendSocketMessage({
			action: "subscribe",
			event_type: "message",
			channel: params.channel,
		});
	});

	createEffect(() => {
		if (scrolled()) return;
		// Wait until both initial messages and additionalMessages are ready
		const msgs = allMessages();

		if (!chatContainer || msgs.length === 0) return;

		// Schedule scroll after DOM updates
		requestAnimationFrame(() => {
			chatContainer!.scrollTop = chatContainer!.scrollHeight;
		});

		setScrolled(true);
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
						const isSubsequent = () => {
							const idx = index();
							const msgs = allMessages();
							return idx !== 0 && msgs[idx - 1]?.author_did === item.author_did;
						};

						return (
							<Message
								isSubsequent={isSubsequent()}
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
