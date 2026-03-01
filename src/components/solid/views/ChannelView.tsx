import { useParams } from "@solidjs/router";
import {
	type Component,
	batch,
	createEffect,
	createMemo,
	createSignal,
	For,
	on,
	onCleanup,
	onMount,
	Show,
	untrack,
} from "solid-js";
import type { IndexedMessageData } from "@/utils/sdk";
import { Message } from "../components/Message/Message";
import { Spinner } from "../icons/Spinner";
import {
	type PendingMessageData,
	useGlobalContext,
} from "../contexts/GlobalContext";
import { useMessageContext } from "../contexts/MessageContext";
import { useMessageHistory } from "../hooks/useMessageHistory";

/**
 * How close to the bottom (in px) the user must be for us to consider them
 * "at the bottom" and auto-scroll when new messages arrive.
 */
const BOTTOM_THRESHOLD = 80;

const ChannelView: Component = () => {
	const params = useParams();
	const [messageData] = useMessageContext();
	const [
		globalState,
		{ sendSocketMessage, clearAdditionalMessages, clearDeletedMessages },
	] = useGlobalContext();

	const history = useMessageHistory(() => params.channel!);

	const [scrolled, setScrolled] = createSignal(false);

	let chatContainer: HTMLDivElement | undefined;
	let topSentinel: HTMLDivElement | undefined;
	let observer: IntersectionObserver | undefined;

	// ── Derived message list ──────────────────────────────────────────────────

	const allMessages = createMemo(
		(): Array<IndexedMessageData | PendingMessageData> => {
			const historicalMessages = history.pages();
			const newlyReceivedMessages = globalState.additionalMessages;
			const pendingMessages = globalState.pendingMessages;
			const deletedMessages = globalState.deletedMessages;

			const editedMessages = newlyReceivedMessages.filter((msg) => msg.edited);
			const newMessages = newlyReceivedMessages.filter((msg) => !msg.edited);

			const updatedHistorical = historicalMessages.map((msg) => {
				const editedVersion = editedMessages.find(
					(e) => e.rkey === msg.rkey && e.author_did === msg.author_did,
				);
				return editedVersion ?? msg;
			});

			return [...updatedHistorical, ...newMessages, ...pendingMessages]
				.filter((message) => message.channel === params.channel)
				.filter((message) => {
					if ("hash" in message) return true;
					return !deletedMessages.find(
						(d) =>
							message.author_did === d.author_did &&
							message.channel === d.channel &&
							message.rkey === d.rkey,
					);
				})
				.sort(
					(a, b) =>
						new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
				);
		},
	);

	// ── Scroll helpers ────────────────────────────────────────────────────────

	const isAtBottom = () => {
		if (!chatContainer) return true;
		return (
			chatContainer.scrollHeight -
				chatContainer.scrollTop -
				chatContainer.clientHeight <
			BOTTOM_THRESHOLD
		);
	};

	const scrollToBottom = () => {
		if (!chatContainer) return;
		chatContainer.scrollTop = chatContainer.scrollHeight;
	};

	// ── IntersectionObserver: upward pagination ───────────────────────────────

	const setupIntersectionObserver = () => {
		observer?.disconnect();
		if (!chatContainer) return;

		observer = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				if (!entry?.isIntersecting || history.reachedTop()) return;
				history.fetchOlderMessages();
			},
			{
				root: chatContainer,
				threshold: 0,
				rootMargin: "120px 0px 0px 0px",
			},
		);

		if (topSentinel) {
			observer.observe(topSentinel);
		}
	};

	onMount(() => {
		setupIntersectionObserver();
	});

	onCleanup(() => {
		observer?.disconnect();
	});

	// ── Channel navigation ────────────────────────────────────────────────────

	createEffect(
		on(
			() => params.channel,
			(channel) => {
				if (!channel) return;

				batch(() => {
					history.reset();
					setScrolled(false);
				});

				setupIntersectionObserver();
				history.fetchOlderMessages();
			},
		),
	);

	// ── WebSocket subscription ────────────────────────────────────────────────

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

	// ── Scroll: initial scroll-to-bottom ─────────────────────────────────────

	// Once the first fetch completes, scroll to the bottom once.
	// setScrolled(true) prevents this from ever running again for this channel.
	createEffect(() => {
		if (scrolled()) return;
		if (!history.reachedTop() && allMessages().length === 0) return;

		scrollToBottom();
		setScrolled(true);
	});

	// ── Scroll: follow new messages at the bottom ─────────────────────────────

	// When a new message is appended and the user is already near the bottom,
	// scroll to reveal it. We track message count reactively; the actual scroll
	// check reads chatContainer untracked so it doesn't create a dependency.
	createEffect(
		on(
			() => allMessages().length,
			() => {
				if (!scrolled()) return;
				// isAtBottom reads chatContainer — untrack so we don't subscribe to
				// any signals that might be inside it.
				if (untrack(isAtBottom)) {
					requestAnimationFrame(scrollToBottom);
				}
			},
		),
	);

	// ── Scroll: restore position after upward pagination ─────────────────────

	// When a pagination fetch starts we capture the distance-from-bottom.
	// When loading transitions back to false the DOM has been updated with the
	// new messages prepended, so we restore that distance to keep the viewport
	// on the same message the user was looking at.
	let scrollBottomBeforeFetch: number | null = null;

	createEffect(
		on(
			() => history.loading(),
			(isLoading) => {
				if (isLoading) {
					// Fetch just started — snapshot current position.
					if (chatContainer) {
						scrollBottomBeforeFetch =
							chatContainer.scrollHeight - chatContainer.scrollTop;
					}
				} else if (scrollBottomBeforeFetch !== null) {
					// Fetch just finished — restore position after DOM has updated.
					const savedBottom = scrollBottomBeforeFetch;
					scrollBottomBeforeFetch = null;
					queueMicrotask(() => {
						if (chatContainer) {
							chatContainer.scrollTop =
								chatContainer.scrollHeight - savedBottom;
						}
					});
				}
			},
		),
	);

	// ── Jump-to-reply ─────────────────────────────────────────────────────────

	createEffect(() => {
		const target = messageData.focusedMessage;
		if (!target) return;

		const scrollToTarget = () => {
			const nodes =
				document.querySelectorAll<HTMLDivElement>("div[data-message]");
			for (const node of nodes) {
				const data = JSON.parse(node.dataset.message!) as IndexedMessageData;
				if (
					data.author_did === target.author_did &&
					data.rkey === target.rkey
				) {
					node.scrollIntoView({ behavior: "smooth", block: "center" });
					return true;
				}
			}
			return false;
		};

		if (scrollToTarget()) return;

		history.fetchUntilMessage(target.rkey).then((found) => {
			if (found) {
				requestAnimationFrame(() => scrollToTarget());
			}
		});
	});

	// ── Render ────────────────────────────────────────────────────────────────

	return (
		<div class="w-full h-full relative">
			{/* Initial load spinner — shown before any messages have loaded */}
			<Show when={history.loading() && allMessages().length === 0}>
				<div class="absolute inset-0 flex items-center justify-center pointer-events-none">
					<Spinner classList={{}} className="w-5 h-5 text-muted-foreground" />
				</div>
			</Show>

			<div class="w-full h-full overflow-auto pb-4" ref={chatContainer}>
				{/* Top sentinel — observed for upward pagination */}
				<div ref={topSentinel} class="w-full h-px" aria-hidden="true" />

				{/* Pagination spinner — shown above existing messages while paginating upward */}
				<Show when={history.loading() && allMessages().length > 0}>
					<div class="w-full flex justify-center py-2">
						<Spinner classList={{}} className="w-4 h-4 text-muted-foreground" />
					</div>
				</Show>

				{/* Start-of-channel banner */}
				<Show when={history.reachedTop()}>
					<div class="w-full flex flex-col justify-center items-center px-4 text-center">
						<h3 class="mb-0">This is the start of this channel.</h3>
						<p class="mb-2">
							Send some messages to get the discussion started!
						</p>
					</div>
				</Show>

				{/* Message list */}
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
			</div>
		</div>
	);
};

export default ChannelView;
