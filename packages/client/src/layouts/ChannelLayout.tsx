import type { FileError } from "@kobalte/core/file-field";
import {
	createEffect,
	createMemo,
	createSignal,
	For,
	Match,
	on,
	onCleanup,
	onMount,
	type ParentComponent,
	Show,
	Switch,
	untrack,
} from "solid-js";
import { toast } from "somoto";
import ArrowDownIcon from "~icons/ph/arrow-down";
import BellIcon from "~icons/ph/bell";
import BellSlashIcon from "~icons/ph/bell-slash";
import CaretLeftIcon from "~icons/ph/caret-left";
import ChatCircleDotsIcon from "~icons/ph/chat-circle-dots";
import UsersIcon from "~icons/ph/users";
import UsersIconFill from "~icons/ph/users-fill";
import XIcon from "~icons/ph/x";
import type { Message as MessageData } from "../atproto/xrpc/social/colibri/channel/listMessages";
import { Message } from "../components/app/channel/message/Message";
import { MessageInput } from "../components/app/community/MessageInput";
import { Button } from "../components/ui/Button";
import {
	FileField,
	FileFieldDropzone,
	FileFieldHiddenInput,
} from "../components/ui/FileField";
import {
	Tooltip,
	TooltipContent,
	TooltipPortal,
	TooltipTrigger,
} from "../components/ui/Tooltip";
import { ChannelContextProvider, useChannelContext } from "../contexts/Channel";
import { useCommunityContext } from "../contexts/Community";
import { useMutes } from "../contexts/Mutes";
import { isSameChannelUri, useNotifications } from "../contexts/Notifications";
import { ScrollAnchorProvider } from "../contexts/ScrollAnchor";
import { useUserContext } from "../contexts/User";
import { useUserPreferences } from "../contexts/UserPreferences";
import { useViewport } from "../contexts/Viewport";
import { getChannelParam } from "../utils/get-param";
import { createMobilePane } from "../utils/mobile-pane";

type MessageMeta = {
	isOnNewDay: boolean;
	isSubsequent: boolean;
	hasSubsequent: boolean;
	dateLabel: string | undefined;
};

/** Maximum number of files that can be attached to a single message. */
const MAX_ATTACHMENTS = 10;

/** Turns a Kobalte file-field rejection code into a human-readable message. */
const describeFileError = (error: FileError, fileName: string): string => {
	switch (error) {
		case "TOO_MANY_FILES":
			return `You can attach up to ${MAX_ATTACHMENTS} files per message.`;
		case "FILE_TOO_LARGE":
			return `"${fileName}" is too large to attach.`;
		case "FILE_TOO_SMALL":
			return `"${fileName}" is too small to attach.`;
		case "FILE_INVALID_TYPE":
			return `"${fileName}" isn't a supported file type.`;
		default:
			return `"${fileName}" couldn't be added.`;
	}
};

const sameDay = (a: string, b: string): boolean =>
	new Date(a).toDateString() === new Date(b).toDateString();

const GROUPING_WINDOW_MS = 5 * 60 * 1000;

const withinGroupingWindow = (a: string, b: string): boolean =>
	Math.abs(new Date(a).getTime() - new Date(b).getTime()) < GROUPING_WINDOW_MS;

const rkeyOf = (uri: string): string => uri.split("/").pop() ?? "";

type RichMessage = MessageData & { createdAt: string };

const DEFAULT_META: MessageMeta = {
	isOnNewDay: false,
	isSubsequent: false,
	hasSubsequent: false,
	dateLabel: undefined,
};

const ChannelLayout: ParentComponent = (props) => {
	const community = useCommunityContext();
	const channel = useChannelContext();
	const notifications = useNotifications();
	const user = useUserContext();
	const mutes = useMutes();
	const { preferences, toggleMembersVisible } = useUserPreferences();
	const { isMobile, popPane, pushPane } = createMobilePane();
	const viewport = useViewport();

	const toggleChannelMute = () => {
		const channelUri = channel.channelUri();
		if (mutes.isChannelMuted(channelUri)) {
			mutes.unmuteChannel(channelUri);
			if (isMobile()) toast.success("Channel unmuted");
		} else {
			mutes.muteChannel(channelUri);
			if (isMobile()) toast.success("Channel muted");
		}
	};

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
	let readObserver: IntersectionObserver | undefined;
	let armedFocusUri: string | undefined;
	let focusWalkUri: string | undefined;
	let focusWalkAttempts = 0;
	const FOCUS_WALK_CAP = 50;
	let cursorWalkAttempts = 0;
	let didInitialScroll = false;
	let scrollBottomBeforeFetch: number | null = null;
	let wasAtBottom = false;
	let pingObserver: IntersectionObserver | undefined;
	const [unseenPings, setUnseenPings] = createSignal<Set<string>>(new Set());
	const [deletedPingBanner, setDeletedPingBanner] = createSignal(false);
	let handledOrphans = new Set<string>();
	const [showJumpToLatest, setShowJumpToLatest] = createSignal(false);
	let jumpObserver: IntersectionObserver | undefined;
	let jumpSentinel: HTMLElement | undefined;

	const jumpSentinelIndex = createMemo(() => {
		const n = channel.messages().length;
		return n > 50 ? n - 50 : -1;
	});

	const scrollToBottom = () => {
		if (!scrollContainer) return;
		scrollContainer.scrollTop = scrollContainer.scrollHeight;
		wasAtBottom = true;
	};

	const REPIN_MAX_FRAMES = 20;
	const REPIN_STABLE_FRAMES = 2;

	const pinToBottomStable = () => {
		if (!scrollContainer) return;
		let lastHeight = -1;
		let stable = 0;
		let frames = 0;
		const step = () => {
			if (!scrollContainer || !wasAtBottom) return;
			if (scrollBottomBeforeFetch !== null) return;
			const h = scrollContainer.scrollHeight;
			scrollContainer.scrollTop = h;
			wasAtBottom = true;
			if (h === lastHeight) {
				stable++;
			} else {
				stable = 0;
				lastHeight = h;
			}
			if (stable >= REPIN_STABLE_FRAMES || ++frames >= REPIN_MAX_FRAMES) return;
			requestAnimationFrame(step);
		};
		requestAnimationFrame(step);
	};

	const observeJumpSentinel = (el: HTMLDivElement) => {
		if (jumpSentinel && jumpObserver) jumpObserver.unobserve(jumpSentinel);
		jumpSentinel = el;
		jumpObserver?.observe(el);
	};

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

		if (wasAtBottom) {
			channel.advanceReadCursor();
			notifications.markChannelRead(channel.channelUri());
		}
	};

	onMount(() => {
		setupObserver();
		scrollContainer?.addEventListener("scroll", handleScroll, {
			passive: true,
		});

		jumpObserver = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				if (!entry) return;
				const root = entry.rootBounds;
				setShowJumpToLatest(
					!entry.isIntersecting &&
						!!root &&
						entry.boundingClientRect.top >= root.bottom,
				);
			},
			{ root: scrollContainer },
		);

		if (messagesWrapper) {
			contentResizeObserver = new ResizeObserver(() => {
				if (!scrollContainer || !didInitialScroll) return;
				if (scrollBottomBeforeFetch !== null) return; // prepend in progress
				if (wasAtBottom) pinToBottomStable();
			});
			contentResizeObserver.observe(messagesWrapper);
		}
	});

	onCleanup(() => {
		observer?.disconnect();
		contentResizeObserver?.disconnect();
		readObserver?.disconnect();
		pingObserver?.disconnect();
		jumpObserver?.disconnect();
		scrollContainer?.removeEventListener("scroll", handleScroll);
	});

	createEffect(() => {
		if (jumpSentinelIndex() !== -1) return;
		if (jumpSentinel && jumpObserver) jumpObserver.unobserve(jumpSentinel);
		jumpSentinel = undefined;
		setShowJumpToLatest(false);
	});

	createEffect(() => {
		const uris = channel.initialUnseen();
		pingObserver?.disconnect();
		pingObserver = undefined;
		setUnseenPings(new Set(uris));
	});

	createEffect(() => {
		const pending = unseenPings();
		channel.messages(); // track so newly-mounted rows get observed
		if (!scrollContainer || pending.size === 0) return;

		if (!pingObserver) {
			pingObserver = new IntersectionObserver(
				(entries) => {
					for (const entry of entries) {
						if (!entry.isIntersecting) continue;
						const node = entry.target as HTMLElement;
						pingObserver?.unobserve(node);
						const uri = node.getAttribute("data-message-uri");
						if (!uri) continue;
						let wasPending = false;
						setUnseenPings((prev) => {
							if (!prev.has(uri)) return prev;
							wasPending = true;
							const next = new Set(prev);
							next.delete(uri);
							return next;
						});
						if (wasPending)
							notifications.markMessageSeen(uri, channel.channelUri());
					}
				},
				{ root: scrollContainer, threshold: 0 },
			);
		}

		queueMicrotask(() => {
			if (!scrollContainer || !pingObserver) return;
			for (const uri of unseenPings()) {
				const node = scrollContainer.querySelector<HTMLElement>(
					`[data-message-uri="${CSS.escape(uri)}"]`,
				);
				if (node) pingObserver.observe(node);
			}
		});
	});

	createEffect(() => {
		const uri = channel.channelUri();
		if (!uri || channel.initialLoading()) return;
		if (mutes.isChannelMuted(uri)) return;

		const unseen = channel.initialUnseen();
		if (unseen.length === 0) return;

		const msgs = channel.messages();
		const present = new Set(msgs.map((m) => m.uri));
		const oldestRkey = msgs[0] ? rkeyOf(msgs[0].uri) : undefined;
		const allLoaded = !channel.hasMore();

		const orphans = unseen.filter(
			(u) =>
				!present.has(u) &&
				!handledOrphans.has(u) &&
				(allLoaded || (oldestRkey !== undefined && rkeyOf(u) > oldestRkey)),
		);
		if (orphans.length === 0) return;

		for (const u of orphans) {
			handledOrphans.add(u);
			notifications.markMessageSeen(u, uri);
		}
		setDeletedPingBanner(true);
	});

	createEffect(() => {
		const target = notifications.pendingFocus();
		if (!target || !isSameChannelUri(target.channelUri, channel.channelUri())) {
			readObserver?.disconnect();
			readObserver = undefined;
			armedFocusUri = undefined;
			return;
		}

		if (focusWalkUri !== target.messageUri) {
			focusWalkUri = target.messageUri;
			focusWalkAttempts = 0;
		}

		const present = channel.messages().some((m) => m.uri === target.messageUri);
		if (!present) {
			if (channel.hasMore() && focusWalkAttempts < FOCUS_WALK_CAP) {
				focusWalkAttempts++;
				channel.loadOlder(); // no-op while inflight
			} else {
				// Not in this channel's history (deleted, or beyond the cap)
				notifications.clearPendingFocus();
			}
			return;
		}

		if (armedFocusUri === target.messageUri) return; // already armed
		armedFocusUri = target.messageUri;

		channel.jumpToMessage(target.messageUri);

		queueMicrotask(() => {
			if (!scrollContainer) return;
			const node = scrollContainer.querySelector<HTMLElement>(
				`[data-message-uri="${CSS.escape(target.messageUri)}"]`,
			);
			if (!node) {
				armedFocusUri = undefined; // let a later messages() change retry
				return;
			}
			readObserver?.disconnect();
			readObserver = new IntersectionObserver(
				(entries) => {
					if (!entries[0]?.isIntersecting) return;
					readObserver?.disconnect();
					readObserver = undefined;
					notifications.markMessageSeen(target.messageUri, target.channelUri);
					notifications.clearPendingFocus();
				},
				{ root: scrollContainer, threshold: 0 },
			);
			readObserver.observe(node);
		});
	});

	createEffect(
		on(channel.channelUri, () => {
			didInitialScroll = false;
			wasAtBottom = false;
			cursorWalkAttempts = 0;
			handledOrphans = new Set();
			setDeletedPingBanner(false);
			setupObserver();
		}),
	);

	createEffect(() => {
		if (didInitialScroll) return;
		if (channel.initialLoading()) return;
		if (channel.messages().length === 0 && channel.hasMore()) return;
		if (!channel.readCursorResolved()) return;

		const cursorUri = channel.readCursorUri();
		const msgs = channel.messages();
		const cursorIdx = cursorUri
			? msgs.findIndex((m) => m.uri === cursorUri)
			: -1;

		if (cursorUri && cursorIdx === -1) {
			if (channel.hasMore() && cursorWalkAttempts < FOCUS_WALK_CAP) {
				cursorWalkAttempts++;
				channel.loadOlder();
				return;
			}
		}

		didInitialScroll = true;

		const landOnCursor = cursorIdx >= 0 && cursorIdx < msgs.length - 1;

		requestAnimationFrame(() => {
			const node =
				landOnCursor && cursorUri && scrollContainer
					? scrollContainer.querySelector<HTMLElement>(
							`[data-message-uri="${CSS.escape(cursorUri)}"]`,
						)
					: null;

			if (node) {
				node.scrollIntoView({ block: "start" });
			} else {
				wasAtBottom = true;
				pinToBottomStable();
			}

			channel.advanceReadCursor();
			notifications.markChannelRead(channel.channelUri());
		});
	});

	createEffect(
		on(
			viewport.height,
			() => {
				if (!didInitialScroll || !scrollContainer) return;
				if (!wasAtBottom) return;
				if (scrollBottomBeforeFetch !== null) return;
				pinToBottomStable();
			},
			{ defer: true },
		),
	);

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

	createEffect(
		on(
			() => channel.newIncomingMessage(),
			(count) => {
				if (!count) return; // skip initial 0
				if (!didInitialScroll || !scrollContainer) return;
				if (!wasAtBottom) return;
				requestAnimationFrame(() => scrollToBottom());
				channel.clearUnreadBoundary();
			},
		),
	);

	createEffect(
		on(
			() => channel.outgoingMessage(),
			(count) => {
				if (!count) return; // skip initial 0
				if (!didInitialScroll || !scrollContainer) return;
				// The user just sent a message — always pin to the bottom.
				requestAnimationFrame(() => scrollToBottom());
				channel.clearUnreadBoundary();
			},
		),
	);

	createEffect(
		on(
			() => channel.editingMessage(),
			(editing) => {
				if (!editing) return;
				if (!didInitialScroll || !scrollContainer) return;
				const msgs = channel.messages();
				const last = msgs[msgs.length - 1];
				// Only the newest message can grow off the bottom edge when its
				// inline editor expands — pin to the bottom so it stays in view.
				if (!last || last.uri !== editing.uri) return;
				requestAnimationFrame(() => scrollToBottom());
			},
		),
	);

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
						if (!untrack(() => didInitialScroll)) return;
						scrollContainer.scrollTop = scrollContainer.scrollHeight - saved;
					});
				}
			},
		),
	);

	const isRestricted = () =>
		!!channel.data()?.ownerOnly ||
		(channel.data()?.allowedRoles?.length ?? 0) > 0 ||
		(channel.data()?.allowedMembers?.length ?? 0) > 0;

	const canTalk = () => {
		if (!isRestricted() || community().ownerDid() === user.did) return true;

		if (channel.data()?.ownerOnly && community().ownerDid() === user.did)
			return true;
		if (channel.data()?.allowedMembers?.includes(user.did)) return true;

		const member = community().members.find((x) => x.did === user.did)!;

		if (
			member.roles.find((x) =>
				channel.data()?.allowedRoles?.some((y) => x === y),
			)
		) {
			return true;
		}

		return false;
	};

	return (
		<div class="w-full h-full flex flex-col min-h-0 flex-1">
			<div class="sticky top-0 left-0 border-b border-border bg-background h-12 p-2 w-full flex flex-row items-center justify-between">
				<div class="flex flex-row gap-2 pl-1 items-center min-w-0 flex-1">
					<Show when={isMobile()}>
						<button
							type="button"
							onClick={() => popPane()}
							class="w-8 h-8 shrink-0 flex items-center justify-center rounded-md hover:bg-muted/50 cursor-pointer -ml-1"
							aria-label="Back"
						>
							<CaretLeftIcon width={20} height={20} />
						</button>
					</Show>
					<Switch>
						<Match
							when={
								channel.data()!.type === "text" ||
								channel.data()!.type === "social.colibri.channel.text"
							}
						>
							<ChatCircleDotsIcon
								class="text-muted-foreground shrink-0"
								width={20}
								height={20}
							/>
						</Match>
					</Switch>
					<span class="shrink-0 whitespace-nowrap">{channel.data()!.name}</span>
					<Show when={channel.data()!.description}>
						<span class="text-muted-foreground shrink-0">—</span>
						<span class="text-muted-foreground min-w-0 flex-1 overflow-hidden whitespace-nowrap text-ellipsis">
							{channel.data()!.description}
						</span>
					</Show>
				</div>
				<div class="h-full flex items-center gap-1">
					<Tooltip>
						<TooltipTrigger>
							<Button
								size="sm"
								variant="ghost"
								class="w-8 h-8"
								onClick={toggleChannelMute}
							>
								<Switch>
									<Match when={mutes.isChannelMuted(channel.channelUri())}>
										<BellSlashIcon />
									</Match>
									<Match when={!mutes.isChannelMuted(channel.channelUri())}>
										<BellIcon />
									</Match>
								</Switch>
							</Button>
						</TooltipTrigger>
						<TooltipPortal>
							<TooltipContent>
								<Switch>
									<Match when={mutes.isChannelMuted(channel.channelUri())}>
										Unmute Channel
									</Match>
									<Match when={!mutes.isChannelMuted(channel.channelUri())}>
										Mute Channel
									</Match>
								</Switch>
							</TooltipContent>
						</TooltipPortal>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger>
							<Button
								size="sm"
								variant="ghost"
								class="w-8 h-8"
								onClick={() =>
									isMobile() ? pushPane("members") : toggleMembersVisible()
								}
							>
								<Switch>
									<Match when={preferences().membersListVisible}>
										<UsersIconFill />
									</Match>
									<Match when={!preferences().membersListVisible}>
										<UsersIcon />
									</Match>
								</Switch>
							</Button>
						</TooltipTrigger>
						<TooltipPortal>
							<TooltipContent>
								<Switch>
									<Match when={preferences().membersListVisible}>
										Hide Member List
									</Match>
									<Match when={!preferences().membersListVisible}>
										Show Member List
									</Match>
								</Switch>
							</TooltipContent>
						</TooltipPortal>
					</Tooltip>
				</div>
			</div>
			<FileField
				class="gap-0! flex flex-col flex-1 min-h-0"
				multiple
				maxFiles={MAX_ATTACHMENTS}
				onFileReject={(rejections) => {
					// One toast per distinct reason — TOO_MANY_FILES otherwise repeats
					// once for every excess file.
					const messages = [
						...new Set(
							rejections.flatMap((r) =>
								r.errors.map((e) => describeFileError(e, r.file.name)),
							),
						),
					];

					toast.error(
						rejections.length === 1
							? "Couldn't add file"
							: "Couldn't add files",
						{ description: messages.join("\n") },
					);
				}}
			>
				<FileFieldDropzone class="border-none gap-0! flex flex-col flex-1 min-h-0">
					<div
						class="contents"
						onClick={(e) => e.stopPropagation()}
						onKeyDown={(e) => e.stopPropagation()}
					>
						<div class="relative w-full flex-1 min-h-0">
							<div
								class="w-full h-full overflow-y-auto"
								style={{ "overflow-anchor": "none" }}
								ref={scrollContainer}
							>
								<div ref={topSentinel} class="w-full h-px" aria-hidden="true" />
								<ScrollAnchorProvider container={() => scrollContainer}>
									<div
										ref={messagesWrapper}
										class="h-[calc(100%-1px)] w-full [&>div]:last-of-type:pb-6"
									>
										<Show
											when={
												channel.loadingOlder() && channel.messages().length > 0
											}
										>
											<div class="w-full text-center py-2 text-xs text-muted-foreground">
												Loading older messages...
											</div>
										</Show>

										<Show
											when={!channel.hasMore() && channel.messages().length > 0}
										>
											<div class="w-full text-center py-2 text-sm text-muted-foreground">
												<span class="flex items-center w-full justify-center">
													This is the start of{" "}
													<ChatCircleDotsIcon class="w-4 h-4 inline-block ml-1.5 mr-1" />{" "}
													{channel.data()!.name}.
												</span>
												<Show when={isRestricted()}>
													{canTalk()
														? "Send some messages to get the discussion started!"
														: "You are not allowed to send messages in here."}
												</Show>
											</div>
										</Show>

										<Show
											when={
												!channel.hasMore() && channel.messages().length === 0
											}
										>
											<div class="w-full h-full flex items-center justify-center text-center py-2 text-sm text-muted-foreground">
												There's nothing here yet!{" "}
												{canTalk() ? "Be the first to send a message." : ""}
											</div>
										</Show>

										<Show
											when={
												channel.initialLoading() &&
												channel.messages().length === 0
											}
										>
											<div class="w-full text-center py-4 text-sm text-muted-foreground">
												Loading messages...
											</div>
										</Show>

										<Show when={channel.error()}>
											<div class="w-full text-center py-2 text-xs text-destructive">
												{`${channel.error()}`}
											</div>
										</Show>

										<For each={channel.messages()}>
											{(message, index) => {
												const meta = () =>
													messageMeta()[index()] ?? DEFAULT_META;
												const isLastRead = () =>
													channel.readCursorUri() === message.uri &&
													index() < messageMeta().length - 1;
												return (
													<>
														<Show when={index() === jumpSentinelIndex()}>
															<div
																ref={observeJumpSentinel}
																class="w-full h-px"
																aria-hidden="true"
															/>
														</Show>
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
															<div class="w-[calc(100%-2rem)] h-px mx-4 my-2.5 bg-primary/50 flex items-center justify-center select-none">
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

							<Show when={showJumpToLatest()}>
								<Button
									variant="secondary"
									size="sm"
									onClick={() => scrollToBottom()}
									class="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 rounded-full border shadow-md"
								>
									<ArrowDownIcon />
									Jump to latest
								</Button>
							</Show>
						</div>

						<Show when={deletedPingBanner()}>
							<div class="border-t border-border w-full px-4 py-2 bg-destructive/10 text-destructive flex justify-between items-center text-sm">
								<span>The message that caused this ping has been deleted.</span>
								<button
									type="button"
									aria-label="Dismiss"
									onClick={() => setDeletedPingBanner(false)}
									class="cursor-pointer w-6 h-6 flex items-center justify-center hover:text-foreground"
								>
									<XIcon />
								</button>
							</div>
						</Show>

						<Show when={channel.data()}>
							<MessageInput
								disabled={!canTalk()}
								channelName={channel.data()?.name ?? ""}
							/>
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

	const channel = createMemo(() => {
		const rkey = getChannelParam();
		if (!rkey) return undefined;
		return community().channels.find((c) => c.uri.split("/").pop() === rkey);
	});

	return (
		<ChannelContextProvider channel={channel}>
			<Show
				when={channel()}
				fallback={
					<div class="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
						Loading channel...
					</div>
				}
			>
				<ChannelLayout>{props.children}</ChannelLayout>
			</Show>
		</ChannelContextProvider>
	);
};

export default ChannelLayoutWithContext;
