import { useParams } from "@solidjs/router";
import {
	batch,
	type Component,
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
import { ensureUserStateCached } from "@/utils/ensure-user-state-cached";
import type { IndexedMessageData } from "@/utils/sdk";
import { Message } from "../components/Message/Message";
import { useChannelContext } from "../contexts/ChannelContext";
import {
	type PendingMessageData,
	useGlobalContext,
} from "../contexts/GlobalContext";
import { useMessageContext } from "../contexts/MessageContext";
import { useMessageHistory } from "../hooks/useMessageHistory";
import { Spinner } from "../icons/Spinner";

/**
 * How close to the bottom (in px) the user must be for us to consider them
 * "at the bottom" and auto-scroll when new messages arrive.
 */
const BOTTOM_THRESHOLD = 80;

const ChannelView: Component = () => {
	const params = useParams();
	const [previousChannel, setPreviousChannel] = createSignal();
	const channel = createMemo(() => params.channel!);
	const [messageData, { registerEmbedLoadCallback }] = useMessageContext();
	const [
		globalState,
		{
			sendSocketMessage,
			clearAdditionalMessages,
			clearDeletedMessages,
			clearOptimisticMemberUpdates,
			clearMemberOverrides,
			updateUserOnlineState,
		},
	] = useGlobalContext();
	const community = createMemo(
		() => globalState.communities.find((x) => x.rkey === params.community)!,
	);
	const channels = () => useChannelContext();

	const history = useMessageHistory(channel);

	const [scrolled, setScrolled] = createSignal(false);

	let chatContainer: HTMLDivElement | undefined;
	let topSentinel: HTMLDivElement | undefined;
	let observer: IntersectionObserver | undefined;
	let pinnedToBottom = false;
	let atBottom = true;

	const allMessages = createMemo(
		(): Array<IndexedMessageData | PendingMessageData> => {
			const historicalMessages = history.pages();
			const newlyReceivedMessages = globalState.additionalMessages;
			const pendingMessages = globalState.pendingMessages;
			const deletedMessages = globalState.deletedMessages;

			const editedMessages = newlyReceivedMessages.filter((msg) => msg.edited);

			const updatedHistorical = historicalMessages.map((msg) => {
				const editedVersion = editedMessages.find(
					(e) =>
						e.rkey === msg.rkey &&
						e.author_did === msg.author_did &&
						e.author_did !== globalState.user.sub,
				);
				return editedVersion ?? msg;
			});

			const historicalRkeys = new Set(updatedHistorical.map((m) => m.rkey));
			const newMessages = newlyReceivedMessages.filter(
				(msg) => !historicalRkeys.has(msg.rkey),
			);

			const resultingArray = [
				...updatedHistorical,
				...newMessages,
				...pendingMessages,
			]
				.filter((message) => message.channel === channel())
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

			return resultingArray;
		},
	);

	const isAtBottom = () => {
		if (!chatContainer) return true;
		return (
			chatContainer.scrollHeight -
				chatContainer.scrollTop -
				chatContainer.clientHeight <
			BOTTOM_THRESHOLD
		);
	};

	const updateAtBottom = () => {
		atBottom = isAtBottom();
	};

	const scrollToBottom = () => {
		if (!chatContainer) return;
		chatContainer.scrollTop = chatContainer.scrollHeight;
	};

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

		chatContainer?.addEventListener("scroll", updateAtBottom, {
			passive: true,
		});

		const unregister = registerEmbedLoadCallback(() => {
			if (pinnedToBottom || atBottom) {
				requestAnimationFrame(scrollToBottom);
			}
		});

		onCleanup(() => {
			chatContainer?.removeEventListener("scroll", updateAtBottom);
			unregister();
		});
	});

	onCleanup(() => {
		observer?.disconnect();
	});

	createEffect(
		on(channel, (channel) => {
			if (!channel) return;

			batch(() => {
				history.reset();
				setScrolled(false);
			});

			setupIntersectionObserver();
			history.fetchOlderMessages();
		}),
	);

	const channelData = () =>
		channels()
			?.channels()
			.find((x) => x.rkey === channel());

	createEffect(() => {
		const previous = previousChannel();

		sendSocketMessage({
			action: "unsubscribe",
			event_type: "message",
			channel: previous,
		});

		clearAdditionalMessages();
		clearDeletedMessages();

		setPreviousChannel(channel());

		sendSocketMessage({
			action: "subscribe",
			event_type: "message",
			channel: channel(),
		});

		if (!channelData()) return;

		document.title = channelData()?.name || "Unknown Channel";
	});

	onCleanup(() => {
		clearOptimisticMemberUpdates();
		clearMemberOverrides();
	});

	createEffect(() => {
		if (scrolled()) return;
		if (!history.reachedTop() && allMessages().length === 0) return;

		atBottom = true;
		pinnedToBottom = true;
		requestAnimationFrame(() => {
			scrollToBottom();
			pinnedToBottom = false;
			atBottom = true;
		});
		setScrolled(true);
	});

	createEffect(
		on(
			() => allMessages().length,
			() => {
				if (!scrolled()) return;
				if (untrack(isAtBottom)) {
					atBottom = true;
					pinnedToBottom = true;
					requestAnimationFrame(() => {
						scrollToBottom();
						pinnedToBottom = false;
						atBottom = true;
					});
				} else {
					atBottom = false;
				}
			},
		),
	);

	let scrollBottomBeforeFetch: number | null = null;

	createEffect(
		on(
			() => history.loading(),
			(isLoading) => {
				if (isLoading) {
					if (chatContainer) {
						scrollBottomBeforeFetch =
							chatContainer.scrollHeight - chatContainer.scrollTop;
					}
				} else if (scrollBottomBeforeFetch !== null) {
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

	return (
		<div class="w-full h-full relative">
			<Show when={history.loading() && allMessages().length === 0}>
				<div class="absolute inset-0 flex items-center justify-center pointer-events-none">
					<Spinner className="w-5 h-5 text-muted-foreground" />
				</div>
			</Show>
			<div class="w-full h-full overflow-auto pb-4" ref={chatContainer}>
				<div ref={topSentinel} class="w-full h-px" aria-hidden="true" />
				<Show when={history.loading() && allMessages().length > 0}>
					<div class="w-full flex justify-center py-2">
						<Spinner className="w-4 h-4 text-muted-foreground" />
					</div>
				</Show>
				<Show when={history.reachedTop()}>
					<div class="w-full flex flex-col justify-center items-center px-4 text-center">
						<h3 class="mb-0">
							This is the start of{" "}
							{channelData()?.owner_only ? "this owner-only" : "this"} channel.
						</h3>
						<p class="mb-2">
							{channelData()?.owner_only &&
							community().owner_did !== globalState.user.sub
								? "You are not allowed to send messages in here."
								: "Send some messages to get the discussion started!"}
						</p>
					</div>
				</Show>
				<For each={allMessages()}>
					{(item, index) => {
						const msgs = allMessages();
						const idx = index();

						const isOnNewDay = () => {
							return (
								idx !== 0 &&
								new Date(msgs[idx - 1]?.created_at).getDay() !==
									new Date(item.created_at).getDay()
							);
						};

						const hasSubsequent = () => {
							return (
								msgs[idx + 1]?.author_did === item.author_did &&
								new Date(msgs[idx + 1]?.created_at).getDay() ===
									new Date(item.created_at).getDay()
							);
						};

						const isSubsequent = () => {
							return (
								idx !== 0 &&
								msgs[idx - 1]?.author_did === item.author_did &&
								!isOnNewDay()
							);
						};

						ensureUserStateCached(
							item.author_did,
							item.state,
							globalState,
							updateUserOnlineState,
						);

						return (
							<>
								<Show when={isOnNewDay()}>
									<div class="w-[calc(100%-2rem)] h-px m-4 bg-border flex items-center justify-center select-none">
										<span class="text-sm bg-background px-1">
											{new Date(item.created_at).toLocaleDateString()}
										</span>
									</div>
								</Show>
								<Message
									isSubsequent={isSubsequent()}
									hasSubsequent={hasSubsequent()}
									data={item as PendingMessageData | IndexedMessageData}
									community={community()}
								/>
							</>
						);
					}}
				</For>
			</div>
		</div>
	);
};

export default ChannelView;
