import type { ColibriRichTextLink } from "@colibri-social/lib";
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
import { warmPosts } from "../atproto/bsky-post-cache";
import { parseBskyPostUrl } from "../atproto/bsky-post-url";
import { isSnapshotStale } from "../atproto/cache/messages-snapshot";
import { warmMetadata } from "../atproto/embed-metadata-cache";
import type { Message as MessageData } from "../atproto/xrpc/social/colibri/channel/listMessages";
import { usesLinkPreview } from "../components/app/channel/message/Embed";
import { Message } from "../components/app/channel/message/Message";
import { ChatGuidelinesModal } from "../components/app/community/ChatGuidelinesModal";
import { MessageInput } from "../components/app/community/MessageInput";
import { Button } from "../components/ui/Button";
import {
	FileField,
	FileFieldDropzone,
	FileFieldHiddenInput,
} from "../components/ui/FileField";
import { StatusPill } from "../components/ui/StatusPill";
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
import { useUserContext } from "../contexts/User";
import { useUserPreferences } from "../contexts/UserPreferences";
import { useViewport } from "../contexts/Viewport";
import { describeError } from "../errors/copy";
import { cancelChannelTrayNotification } from "../notifications";
import { getChannelParam } from "../utils/get-param";
import { sameDay } from "../utils/message-order";
import {
	createDomScrollSurface,
	createScrollAnchor,
	shouldLoadOlder,
	shouldShowJumpToLatest,
} from "../utils/message-scroll";
import { createMobilePane } from "../utils/mobile-pane";

type MessageMeta = {
	isOnNewDay: boolean;
	isSubsequent: boolean;
	hasSubsequent: boolean;
	isLast: boolean;
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

const GROUPING_WINDOW_MS = 5 * 60 * 1000;

const withinGroupingWindow = (a: string, b: string): boolean =>
	Math.abs(new Date(a).getTime() - new Date(b).getTime()) < GROUPING_WINDOW_MS;

const rkeyOf = (uri: string): string => uri.split("/").pop() ?? "";

type RichMessage = MessageData & { createdAt: string };

const DEFAULT_META: MessageMeta = {
	isOnNewDay: false,
	isSubsequent: false,
	hasSubsequent: false,
	isLast: false,
	dateLabel: undefined,
};

const ChannelLayout: ParentComponent = (props) => {
	const community = useCommunityContext();
	const channel = useChannelContext();
	const notifications = useNotifications();
	const user = useUserContext();
	const mutes = useMutes();
	const { preferences, toggleMembersVisible, setChatGuidelinesAccepted } =
		useUserPreferences();
	const [guidelinesOpen, setGuidelinesOpen] = createSignal(false);
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
				isLast: i === msgs.length - 1,
				dateLabel: isOnNewDay
					? new Date(m.createdAt).toLocaleDateString()
					: undefined,
			};
		});
	});

	let scrollContainer: HTMLDivElement | undefined;
	let messagesWrapper: HTMLDivElement | undefined;
	let hiddenInput: HTMLInputElement | undefined;
	let contentResizeObserver: ResizeObserver | undefined;
	let containerResizeObserver: ResizeObserver | undefined;
	let rowMutationObserver: MutationObserver | undefined;
	const rowHeights = new WeakMap<HTMLElement, number>();
	let readObserver: IntersectionObserver | undefined;
	let armedFocusUri: string | undefined;
	let focusWalkUri: string | undefined;
	let focusWalkAttempts = 0;
	const FOCUS_WALK_CAP = 50;
	let cursorWalkAttempts = 0;
	let didInitialScroll = false;
	let pingObserver: IntersectionObserver | undefined;
	const [unseenPings, setUnseenPings] = createSignal<Set<string>>(new Set());
	let unseenIsPing = new Map<string, boolean>();
	const [deletedPingBanner, setDeletedPingBanner] = createSignal(false);
	let handledOrphans = new Set<string>();
	const [showJumpToLatest, setShowJumpToLatest] = createSignal(false);
	let jumpEvaluationFrame: number | undefined;

	const scrollAnchor = createScrollAnchor(
		createDomScrollSurface(
			() => scrollContainer,
			() => messagesWrapper,
		),
	);

	const scrollToBottom = () => {
		scrollAnchor.pinToBottom();
		setShowJumpToLatest(false);
		channel.clearUnreadBoundary();
	};

	const evaluateJumpToLatest = () => {
		if (!scrollContainer || !didInitialScroll) return;
		setShowJumpToLatest((visible) =>
			shouldShowJumpToLatest(scrollAnchor.distanceFromBottom(), visible),
		);
	};

	const scheduleJumpEvaluation = () => {
		if (jumpEvaluationFrame !== undefined) return;
		jumpEvaluationFrame = requestAnimationFrame(() => {
			jumpEvaluationFrame = undefined;
			evaluateJumpToLatest();
		});
	};

	const PREVIEW_WARM_TIMEOUT_MS = 600;

	const linkUrisIn = (messages: Array<MessageData>): Array<string> => {
		const uris = new Set<string>();
		for (const message of messages) {
			for (const facet of message.facets ?? []) {
				const feature = facet.features[0];
				if (feature?.$type !== "social.colibri.richtext.facet#link") continue;
				uris.add((feature as ColibriRichTextLink).uri);
			}
		}
		return [...uris];
	};

	const warmEmbeds = async (messages: Array<MessageData>): Promise<void> => {
		const uris = linkUrisIn(messages);
		const posts = uris
			.map((uri) => parseBskyPostUrl(uri))
			.filter((ref): ref is NonNullable<typeof ref> => ref !== undefined);

		let timer: ReturnType<typeof setTimeout> | undefined;
		await Promise.race([
			Promise.allSettled([
				warmMetadata(user.xrpc, uris.filter(usesLinkPreview)),
				warmPosts(posts),
			]),
			new Promise<void>((resolve) => {
				timer = setTimeout(resolve, PREVIEW_WARM_TIMEOUT_MS);
			}),
		]);
		if (timer !== undefined) clearTimeout(timer);
	};

	const loadOlderPreservingScroll = (): void => {
		void channel.loadOlder({
			prepare: warmEmbeds,
			onBeforePrepend: () => {
				if (untrack(() => didInitialScroll)) scrollAnchor.capture();
			},
			onAfterPrepend: () => {
				if (untrack(() => didInitialScroll)) scrollAnchor.restore();
			},
		});
	};

	const maybeLoadOlder = (): void => {
		if (!scrollContainer) return;
		if (
			!shouldLoadOlder({
				scrollTop: scrollContainer.scrollTop,
				clientHeight: scrollContainer.clientHeight,
				hasMore: channel.hasMore(),
				loading: channel.loadingOlder(),
				ready: didInitialScroll,
			})
		)
			return;
		loadOlderPreservingScroll();
	};

	const observeRow = (node: Node): void => {
		if (!(node instanceof HTMLElement)) return;
		contentResizeObserver?.observe(node);
	};

	const handleContentResize = (entries: Array<ResizeObserverEntry>): void => {
		if (!scrollContainer) return;

		let delta = 0;
		let boundary: number | undefined;

		for (const entry of entries) {
			const row = entry.target;
			if (row === messagesWrapper || !(row instanceof HTMLElement)) continue;

			const height = row.offsetHeight;
			const previous = rowHeights.get(row);
			rowHeights.set(row, height);
			if (previous === undefined || height === previous) continue;

			delta += height - previous;
			const top = row.offsetTop - scrollContainer.scrollTop;
			if (boundary === undefined || top < boundary) boundary = top;
		}

		if (delta !== 0 && boundary !== undefined) {
			scrollAnchor.absorbGrowth(boundary, delta);
			scheduleJumpEvaluation();
			return;
		}

		scrollAnchor.restore();
		scheduleJumpEvaluation();
	};

	const handleScroll = () => {
		if (!scrollContainer) return;
		scrollAnchor.handleScroll();
		evaluateJumpToLatest();

		if (scrollAnchor.isAtBottom()) {
			channel.advanceReadCursor();
			notifications.markChannelRead(channel.channelUri());
			void cancelChannelTrayNotification(channel.channelUri());
		}

		maybeLoadOlder();
	};

	onMount(() => {
		scrollContainer?.addEventListener("scroll", handleScroll, {
			passive: true,
		});

		if (messagesWrapper) {
			contentResizeObserver = new ResizeObserver(handleContentResize);
			contentResizeObserver.observe(messagesWrapper);
			for (const row of messagesWrapper.children) observeRow(row);

			rowMutationObserver = new MutationObserver((mutations) => {
				for (const mutation of mutations) {
					for (const node of mutation.addedNodes) observeRow(node);
					for (const node of mutation.removedNodes) {
						if (node instanceof HTMLElement) {
							contentResizeObserver?.unobserve(node);
						}
					}
				}
			});
			rowMutationObserver.observe(messagesWrapper, { childList: true });
		}

		if (scrollContainer) {
			containerResizeObserver = new ResizeObserver(() => {
				scrollAnchor.restore();
				scheduleJumpEvaluation();
			});
			containerResizeObserver.observe(scrollContainer);
		}
	});

	onCleanup(() => {
		contentResizeObserver?.disconnect();
		containerResizeObserver?.disconnect();
		rowMutationObserver?.disconnect();
		readObserver?.disconnect();
		pingObserver?.disconnect();
		if (jumpEvaluationFrame !== undefined)
			cancelAnimationFrame(jumpEvaluationFrame);
		scrollContainer?.removeEventListener("scroll", handleScroll);
	});

	createEffect(() => {
		const entries = channel.initialUnseen();
		pingObserver?.disconnect();
		pingObserver = undefined;
		unseenIsPing = new Map(entries.map((entry) => [entry.uri, entry.isPing]));
		setUnseenPings(new Set(entries.map((entry) => entry.uri)));
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
						if (wasPending) {
							notifications.markMessageSeen(
								uri,
								channel.channelUri(),
								unseenIsPing.get(uri) === true,
							);
						}
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
			(entry) =>
				!present.has(entry.uri) &&
				!handledOrphans.has(entry.uri) &&
				(allLoaded ||
					(oldestRkey !== undefined && rkeyOf(entry.uri) > oldestRkey)),
		);
		if (orphans.length === 0) return;

		for (const orphan of orphans) {
			handledOrphans.add(orphan.uri);
			notifications.markMessageSeen(orphan.uri, uri, orphan.isPing);
		}
		if (orphans.some((orphan) => orphan.isPing)) setDeletedPingBanner(true);
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
				loadOlderPreservingScroll(); // no-op while inflight
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
					notifications.markMessageSeen(
						target.messageUri,
						target.channelUri,
						true,
					);
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
			cursorWalkAttempts = 0;
			handledOrphans = new Set();
			setDeletedPingBanner(false);
			setShowJumpToLatest(false);
		}),
	);

	createEffect(
		on(
			() => channel.loadingOlder(),
			(loading) => {
				if (loading) return;
				maybeLoadOlder();
			},
		),
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
				loadOlderPreservingScroll();
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

			const markReadNow = () => {
				channel.advanceReadCursor();
				notifications.markChannelRead(channel.channelUri());
				void cancelChannelTrayNotification(channel.channelUri());
			};

			if (node) {
				node.scrollIntoView({ block: "start" });
				scrollAnchor.capture();
				const landedAtBottom = scrollAnchor.isAtBottom();
				setShowJumpToLatest(!landedAtBottom);
				if (landedAtBottom) markReadNow();
			} else {
				scrollAnchor.pinToBottom();
				setShowJumpToLatest(false);
				markReadNow();
			}
		});
	});

	createEffect(
		on(
			viewport.height,
			() => {
				if (!didInitialScroll) return;
				scrollAnchor.restore();
			},
			{ defer: true },
		),
	);

	createEffect(
		on(
			viewport.keyboardAnimating,
			(animating) => {
				if (animating) return;
				if (!didInitialScroll) return;
				scrollAnchor.restore();
				scheduleJumpEvaluation();
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
				if (!didInitialScroll) return;
				if (scrollAnchor.anchorMode() !== "bottom") return;
				channel.clearUnreadBoundary();
			},
		),
	);

	createEffect(
		on(
			() => channel.outgoingMessage(),
			(count) => {
				if (!count) return; // skip initial 0
				if (!didInitialScroll) return;
				// The user just sent a message — always pin to the bottom.
				scrollAnchor.pinToBottom();
				setShowJumpToLatest(false);
				channel.clearUnreadBoundary();
			},
		),
	);

	createEffect(
		on(
			() => channel.editingMessage(),
			(editing) => {
				if (!editing) return;
				if (!didInitialScroll) return;
				const msgs = channel.messages();
				const last = msgs[msgs.length - 1];
				// Only the newest message can grow off the bottom edge when its
				// inline editor expands — pin to the bottom so it stays in view.
				if (!last || last.uri !== editing.uri) return;
				scrollAnchor.pinToBottom();
				setShowJumpToLatest(false);
			},
		),
	);

	const loadingStatus = () => {
		if (channel.initialLoading() && channel.messages().length === 0)
			return "Loading messages...";
		if (channel.loadingOlder() && channel.messages().length > 0)
			return "Loading older messages...";
		if (
			!channel.hydratedFromNetwork() &&
			isSnapshotStale(channel.snapshotAge())
		)
			return "Catching up...";
		return undefined;
	};

	const isRestricted = () =>
		!!channel.data()?.ownerOnly ||
		(channel.data()?.allowedRoles?.length ?? 0) > 0 ||
		(channel.data()?.allowedMembers?.length ?? 0) > 0;

	const member = () => community().members.find((x) => x.did === user.did);

	const isMember = () => member() !== undefined;

	const canTalk = () => {
		if (!isMember()) return false;
		if (!isRestricted() || community().ownerDid() === user.did) return true;

		if (channel.data()?.ownerOnly && community().ownerDid() === user.did)
			return true;
		if (channel.data()?.allowedMembers?.includes(user.did)) return true;

		return (
			member()?.roles.some((x) =>
				channel.data()?.allowedRoles?.some((y) => x === y),
			) === true
		);
	};

	const needsGuidelines = () =>
		canTalk() && !preferences().chatGuidelinesAccepted;

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
					<span class="min-w-0 truncate">{channel.data()!.name}</span>
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
								class="w-full h-full overflow-y-auto overflow-x-clip pb-6"
								style={{ "overflow-anchor": "none" }}
								ref={scrollContainer}
							>
								<div ref={messagesWrapper} class="w-full">
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
										when={!channel.hasMore() && channel.messages().length === 0}
									>
										<div class="w-full h-full flex items-center justify-center text-center py-2 text-sm text-muted-foreground">
											There's nothing here yet!{" "}
											{canTalk() ? "Be the first to send a message." : ""}
										</div>
									</Show>

									<Show when={channel.error()}>
										{(failure) => (
											<div class="w-full text-center py-2 text-xs text-destructive">
												{describeError(failure()).title}
											</div>
										)}
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
														isLast={meta().isLast}
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
							</div>

							<Show when={loadingStatus()}>
								{(label) => (
									<StatusPill
										spinner
										class="absolute top-2 left-1/2 -translate-x-1/2 z-10"
									>
										{label()}
									</StatusPill>
								)}
							</Show>

							<Show when={showJumpToLatest()}>
								<Button
									variant="secondary"
									size="sm"
									onClick={() => scrollToBottom()}
									class="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 rounded-full border shadow-md"
								>
									<ArrowDownIcon />
									Jump to bottom
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
								disabled={!canTalk() || needsGuidelines()}
								disabledReason={
									needsGuidelines()
										? "To chat on Colibri, you must first read the app's chat guidelines."
										: isMember()
											? "You are not allowed to send messages in this channel."
											: "You are not a member of this community."
								}
								disabledAction={
									needsGuidelines() ? (
										<Button
											size="sm"
											variant="secondary"
											onClick={() => setGuidelinesOpen(true)}
										>
											Open Guidelines
										</Button>
									) : undefined
								}
								channelName={channel.data()?.name ?? ""}
								maxAttachments={MAX_ATTACHMENTS}
							/>
						</Show>
						<ChatGuidelinesModal
							open={guidelinesOpen()}
							onOpenChange={setGuidelinesOpen}
							onAccept={() => setChatGuidelinesAccepted(true)}
						/>

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
