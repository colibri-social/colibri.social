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
import { Message } from "../components/Message/Message";
import {
	type PendingMessageData,
	useGlobalContext,
} from "../contexts/GlobalContext";
import { useMessageContext } from "../contexts/MessageContext";

/**
 * A query used to (pre-) fetch data message data for a channel from the app view.
 * @todo This only fetches the last 50 messages. The appview supports paging (we can
 * implement this via observers) but it's still a work in progress thing.
 */
const fetchMessagesForChannel = query(
	async (channel: string): Promise<Array<IndexedMessageData>> => {
		const response = await fetch(
			`https://${APPVIEW_DOMAIN}/api/messages?channel=${channel}`,
		);
		return response.json();
	},
	"messages",
);

/**
 * A channel view within Colibri.
 */
const ChannelView: Component = () => {
	const params = useParams();
	const [messageData] = useMessageContext();
	const [
		globalState,
		{ sendSocketMessage, clearAdditionalMessages, clearDeletedMessages },
	] = useGlobalContext();
	const messages = createAsync(() => fetchMessagesForChannel(params.channel!));
	const [scrolled, setScrolled] = createSignal(false);

	let chatContainer: HTMLDivElement | undefined;

	/**
	 * A derived signal which contains all messages that should be displayed in a channel.
	 * @returns An array of messages the component can then render.
	 */
	const allMessages = () => {
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
				return (
					new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
				);
			});
	};

	// Handlers for web socket connections to subscribe to new messages / unsubscribe on cleanup
	createEffect(() => {
		sendSocketMessage({
			action: "subscribe",
			event_type: "message",
			channel: params.channel,
		});
	});

	onCleanup(() => {
		sendSocketMessage({
			action: "unsubscribe",
			event_type: "message",
			channel: params.channel,
		});

		clearAdditionalMessages();
		clearDeletedMessages();
	});

	// Scroll to the bottom once messages load in
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

	// When a message is focused, scroll to that message.
	createEffect(() => {
		if (!messageData.focusedMessage) return;

		const messages =
			document.querySelectorAll<HTMLDivElement>("div[data-message]");

		messages.forEach((message) => {
			const data = JSON.parse(message.dataset.message!) as IndexedMessageData;
			if (
				data.author_did === messageData.focusedMessage!.author_did &&
				data.rkey === messageData.focusedMessage!.rkey
			) {
				message.scrollIntoView({
					behavior: "smooth",
					block: "center",
				});
			}
		});
	});

	return (
		<div class="w-full h-full overflow-auto pb-4" ref={chatContainer}>
			<Suspense fallback={<div></div>}>
				<div class="w-full flex flex-col justify-center items-center px-4 text-center">
					<h3 class="mb-0">This is the start of this channel.</h3>
					<p class="mb-2">Send some messages to get the discussion started!</p>
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
