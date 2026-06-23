import type { Details } from "@kobalte/core/file-field";
import {
	createEffect,
	createMemo,
	createSignal,
	For,
	on,
	onCleanup,
	onMount,
	type ParentComponent,
	Show,
	untrack,
} from "solid-js";
import { toast } from "somoto";
import type { Message as MessageData } from "../atproto/xrpc/social/colibri/channel/listMessages";
import { Message } from "../components/app/channel/message/Message";
import { MessageInput } from "../components/app/community/MessageInput";
import {
	FileField,
	FileFieldDropzone,
	FileFieldHiddenInput,
} from "../components/ui/FileField";
import { ChannelContextProvider, useChannelContext } from "../contexts/Channel";
import { useCommunityContext } from "../contexts/Community";
import { ScrollAnchorProvider } from "../contexts/ScrollAnchor";
import { getChannelParam } from "../utils/get-param";

type MessageMeta = {
	/** True when the previous message was authored on a different calendar day. */
	isOnNewDay: boolean;
	/** True when this row continues a run by the same author on the same day. */
	isSubsequent: boolean;
	/** True when the next row will continue the run from this one. */
	hasSubsequent: boolean;
	/** When `isOnNewDay`, the localized date string to show in the divider. */
	dateLabel: string | undefined;
};

/**
 * Calendar-day comparison. The old Astro `ChannelView` used `Date#getDay()`,
 * which returns the day-of-week (0–6) — that silently wraps every 7 days
 * (e.g. Mon Jan 1 and Mon Jan 8 compared equal). `toDateString()` returns
 * a unique string per calendar date so the divider lands in the right
 * places.
 */
const sameDay = (a: string, b: string): boolean =>
	new Date(a).toDateString() === new Date(b).toDateString();

/**
 * Messages from the same author are grouped (subsequent) only when they
 * fall within this window. Keeps the grouping meaningful and avoids
 * collapsing messages hours apart.
 */
const GROUPING_WINDOW_MS = 5 * 60 * 1000;

const withinGroupingWindow = (a: string, b: string): boolean =>
	Math.abs(new Date(a).getTime() - new Date(b).getTime()) < GROUPING_WINDOW_MS;

// The `listMessages` response type lacks `createdAt` and `edited` today, but
// every consumer (Message.tsx, this layout) needs them. Cast through this
// local alias as a stop-gap until that XRPC type is enriched to match the
// real record shape.
// TODO: Drop the cast once `listMessages.ts`'s `Message` carries createdAt.
type RichMessage = MessageData & { createdAt: string };

const DEFAULT_META: MessageMeta = {
	isOnNewDay: false,
	isSubsequent: false,
	hasSubsequent: false,
	dateLabel: undefined,
};

const ChannelLayout: ParentComponent = (props) => {
	const channel = useChannelContext();
	const [files, setFiles] = createSignal<Details>();

	// Per-row meta (isSubsequent / hasSubsequent / new-day divider). Computed
	// once per messages-array update rather than per-row on every reactivity
	// tick — each row just indexes in. Ported and cleaned up from the old
	// Astro `ChannelView`'s inline derived-signal style.
	const messageMeta = createMemo<MessageMeta[]>(() => {
		const msgs = channel.messages() as RichMessage[];
		return msgs.map((m, i): MessageMeta => {
			const prev = i > 0 ? msgs[i - 1] : undefined;
			const next = i < msgs.length - 1 ? msgs[i + 1] : undefined;

			const isOnNewDay = !!prev && !sameDay(prev.createdAt, m.createdAt);
			const isSubsequent =
				!!prev &&
				prev.author.did === m.author.did &&
				!isOnNewDay &&
				withinGroupingWindow(prev.createdAt, m.createdAt);
			const hasSubsequent =
				!!next &&
				next.author.did === m.author.did &&
				sameDay(next.createdAt, m.createdAt) &&
				withinGroupingWindow(m.createdAt, next.createdAt);

			return {
				isOnNewDay,
				isSubsequent,
				hasSubsequent,
				dateLabel: isOnNewDay
					? new Date(m.createdAt).toLocaleDateString()
					: undefined,
			};
		});
	});

	let scrollContainer: HTMLDivElement | undefined;
	let messagesWrapper: HTMLDivElement | undefined;
	let topSentinel: HTMLDivElement | undefined;
	let hiddenInput: HTMLInputElement | undefined;
	let observer: IntersectionObserver | undefined;
	let contentResizeObserver: ResizeObserver | undefined;
	let didInitialScroll = false;
	let scrollBottomBeforeFetch: number | null = null;
	/** True whenever the scroll position is within 80px of the bottom. Updated by handleScroll. */
	let wasAtBottom = false;

	const scrollToBottom = () => {
		if (!scrollContainer) return;
		scrollContainer.scrollTop = scrollContainer.scrollHeight;
		wasAtBottom = true;
	};

	// Wire the IntersectionObserver against the top sentinel: as soon as it
	// scrolls into view (with a 120px head start to feel responsive), kick off
	// a `loadOlder()`. Disconnect once the channel hits the top.
	const setupObserver = () => {
		observer?.disconnect();
		if (!scrollContainer || !topSentinel) return;

		observer = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				if (!entry?.isIntersecting) return;
				if (!channel.hasMore()) return;
				channel.loadOlder();
			},
			{
				root: scrollContainer,
				threshold: 0,
				rootMargin: "120px 0px 0px 0px",
			},
		);
		observer.observe(topSentinel);
	};

	const handleScroll = () => {
		if (!scrollContainer) return;
		const distFromBottom =
			scrollContainer.scrollHeight -
			scrollContainer.scrollTop -
			scrollContainer.clientHeight;
		wasAtBottom = distFromBottom < 80;
		if (wasAtBottom && channel.readCursorUri()) {
			channel.markSeen();
		}
	};

	onMount(() => {
		setupObserver();
		scrollContainer?.addEventListener("scroll", handleScroll, {
			passive: true,
		});

		// When images or embeds expand the content height, re-pin to the bottom
		// if the user was already there — without this the view drifts up.
		if (messagesWrapper) {
			contentResizeObserver = new ResizeObserver(() => {
				if (!scrollContainer || !didInitialScroll) return;
				if (scrollBottomBeforeFetch !== null) return; // prepend in progress
				if (wasAtBottom)
					scrollContainer.scrollTop = scrollContainer.scrollHeight;
			});
			contentResizeObserver.observe(messagesWrapper);
		}
	});

	onCleanup(() => {
		observer?.disconnect();
		contentResizeObserver?.disconnect();
		scrollContainer?.removeEventListener("scroll", handleScroll);
	});

	// On every channel switch, rebind the observer (the messages array gets
	// cleared; the scroll container will be near scrollTop=0 for a moment).
	createEffect(
		on(channel.channelUri, () => {
			didInitialScroll = false;
			wasAtBottom = false;
			setupObserver();
		}),
	);

	// Once the first page has arrived for a freshly-mounted channel, pin to
	// the bottom (chat-style: newest message visible on entry).
	createEffect(() => {
		if (didInitialScroll) return;
		if (channel.initialLoading()) return;
		if (channel.messages().length === 0 && channel.hasMore()) return;

		didInitialScroll = true;
		requestAnimationFrame(() => scrollToBottom());
	});

	// Whenever `focusedMessage` flips to a URI, scroll the matching row into
	// view. The Channel context guarantees the message is loaded by the time
	// `focusedMessage` is set (via `loadOlder` walks inside `jumpToMessage`),
	// but a microtask defer ensures the DOM has the freshly-prepended rows
	// mounted before we query.
	createEffect(
		on(
			() => channel.focusedMessage(),
			(target) => {
				if (!target || !scrollContainer) return;
				queueMicrotask(() => {
					if (!scrollContainer) return;
					const node = scrollContainer.querySelector<HTMLElement>(
						`[data-message-uri="${CSS.escape(target)}"]`,
					);
					node?.scrollIntoView({ behavior: "smooth", block: "center" });
				});
			},
		),
	);

	// Auto-scroll to the bottom when a new message arrives from another user
	// over the socket — but only if the user is already near the bottom, so we
	// don't yank them down while they're reading scrollback.
	createEffect(
		on(
			() => channel.newIncomingMessage(),
			(count) => {
				if (!count) return; // skip initial 0
				if (!didInitialScroll || !scrollContainer) return;
				const distFromBottom =
					scrollContainer.scrollHeight -
					scrollContainer.scrollTop -
					scrollContainer.clientHeight;
				if (distFromBottom < 80) {
					requestAnimationFrame(() => scrollToBottom());
				}
			},
		),
	);

	// Scroll preservation when older pages get prepended: before the fetch
	// fires we capture the distance from the bottom; after the prepend
	// completes we restore that distance so the user's viewport doesn't jump.
	createEffect(
		on(
			() => channel.loadingOlder(),
			(isLoading) => {
				if (isLoading) {
					if (scrollContainer) {
						scrollBottomBeforeFetch =
							scrollContainer.scrollHeight - scrollContainer.scrollTop;
					}
				} else if (scrollBottomBeforeFetch !== null) {
					const saved = scrollBottomBeforeFetch;
					scrollBottomBeforeFetch = null;
					requestAnimationFrame(() => {
						if (!scrollContainer) return;
						// Skip on the very first load — `didInitialScroll` will pin to
						// bottom; we only want preservation behaviour on subsequent
						// prepends triggered by the IntersectionObserver.
						if (!untrack(() => didInitialScroll)) return;
						scrollContainer.scrollTop = scrollContainer.scrollHeight - saved;
					});
				}
			},
		),
	);

	return (
		<div class="w-full h-full flex flex-col min-h-0 flex-1">
			<FileField
				class="gap-0! flex flex-col flex-1 min-h-0"
				multiple
				onFileReject={(data) =>
					toast.error(`Failed to add file.`, {
						description: data
							.map((x) => x.errors.map((y) => y).join(", "))
							.join(", "),
					})
				}
				onFileChange={setFiles}
			>
				<FileFieldDropzone class="border-none gap-0! flex flex-col flex-1 min-h-0">
					<div
						class="contents"
						onClick={(e) => e.stopPropagation()}
						onKeyDown={(e) => e.stopPropagation()}
					>
						<div
							class="w-full flex-1 min-h-0 overflow-y-auto mb-4 h-full"
							style={{ "overflow-anchor": "none" }}
							ref={scrollContainer}
						>
							<div ref={topSentinel} class="w-full h-px" aria-hidden="true" />

							{/* messagesWrapper is observed by the ResizeObserver so that
							    image/embed loads that expand content re-pin the view to
							    the bottom when the user is already there. The
							    ScrollAnchorProvider lets individual media compensate scroll
							    when they load in above the fold (see useStableMedia). */}
							<ScrollAnchorProvider container={() => scrollContainer}>
								<div ref={messagesWrapper} class="h-[calc(100%-1px)] w-full">
									<Show
										when={
											channel.loadingOlder() && channel.messages().length > 0
										}
									>
										<div class="w-full text-center py-2 text-xs text-muted-foreground">
											Loading older messages…
										</div>
									</Show>

									<Show
										when={!channel.hasMore() && channel.messages().length > 0}
									>
										<div class="w-full text-center py-2 text-sm text-muted-foreground">
											This is the start of the channel.
										</div>
									</Show>

									<Show
										when={!channel.hasMore() && channel.messages().length === 0}
									>
										<div class="w-full h-full flex items-center justify-center text-center py-2 text-sm text-muted-foreground">
											There's nothing here yet! Be the first to send a message.
										</div>
									</Show>

									<Show
										when={
											channel.initialLoading() &&
											channel.messages().length === 0
										}
									>
										<div class="w-full text-center py-4 text-sm text-muted-foreground">
											Loading messages…
										</div>
									</Show>

									<Show when={channel.error()}>
										<div class="w-full text-center py-2 text-xs text-destructive">
											{`${channel.error()}`}
										</div>
									</Show>

									<For each={channel.messages()}>
										{(message, index) => {
											const meta = () => messageMeta()[index()] ?? DEFAULT_META;
											const isLastRead = () =>
												channel.readCursorUri() === message.uri &&
												index() < messageMeta().length - 1;
											return (
												<>
													<Show when={meta().dateLabel}>
														{(label) => (
															<div class="w-[calc(100%-2rem)] h-px m-4 bg-border flex items-center justify-center select-none">
																<span class="text-sm bg-background px-1">
																	{label()}
																</span>
															</div>
														)}
													</Show>
													<Message
														data={message}
														isSubsequent={meta().isSubsequent}
														hasSubsequent={meta().hasSubsequent}
													/>
													<Show when={isLastRead()}>
														<div class="w-[calc(100%-2rem)] h-px mx-4 my-1 bg-primary flex items-center justify-center select-none">
															<span class="text-xs bg-background px-1 text-primary font-medium">
																New messages
															</span>
														</div>
													</Show>
												</>
											);
										}}
									</For>
								</div>
							</ScrollAnchorProvider>
						</div>

						<Show when={channel.data()}>
							{(ch) => <MessageInput channelName={ch().name} files={files} />}
						</Show>

						{props.children}
					</div>
				</FileFieldDropzone>
				<FileFieldHiddenInput ref={hiddenInput} />
			</FileField>
		</div>
	);
};

const ChannelLayoutWithContext: ParentComponent = (props) => {
	const community = useCommunityContext();

	// Filter the channel record out of the community context using the rkey
	// from the URL — the route param is just the rkey, so match against the
	// last segment of each channel's full AT-URI. Wrapped in `createMemo` so
	// the lookup re-evaluates when either the URL or the community's channel
	// list changes (e.g. real-time updates).
	const channel = createMemo(() => {
		const rkey = getChannelParam();
		if (!rkey) return undefined;
		return community().channels.find((c) => c.uri.split("/").pop() === rkey);
	});

	return (
		<ChannelContextProvider channel={channel}>
			<ChannelLayout>{props.children}</ChannelLayout>
		</ChannelContextProvider>
	);
};

export default ChannelLayoutWithContext;
