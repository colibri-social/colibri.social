import {
	ChannelHeader,
	IconButton,
	NavHeader,
	ThreadIcon,
} from "@colibri-social/ui";
import { CloseIcon } from "@solar-icons/solid/bold/close";
import { MaximizeSquareIcon } from "@solar-icons/solid/bold/maximize-square";
import { MenuDotsIcon } from "@solar-icons/solid/bold/menu-dots";
import { VolumeSmallIcon } from "@solar-icons/solid/bold/volume-small";
import { createMemo, onCleanup, Show } from "solid-js";
import { isVoiceChannel, skeyOf } from "../../data/ids";
import { useData } from "../../data/store";
import type { ChannelView, ThreadView } from "../../data/types";
import { defineContract, slot } from "../../screen/define";
import { useOptionalDesktopShell } from "../../shell/desktop/context";
import type { ThreadLayer } from "../../shell/layers";
import { LoadErrorState } from "../../shell/load-error";
import { type Navigator, useStack } from "../../shell/stack";
import {
	ConversationComposer,
	ConversationMessages,
	ConversationUnavailable,
	createConversation,
} from "../channel/conversation";
import { createThreadMenu } from "../threads/thread-menu";
import { closePane } from "./close-pane";
import { ThreadIntro } from "./thread-intro";

export type ThreadArgs = { space: string; channel: string; thread: string };

type ThreadModel = {
	stack: Navigator;
	options: { label: () => string; channel: string; space: string };
	unavailable: () => string | undefined;
	parent: () => ChannelView | undefined;
	thread: () => ThreadView | undefined;
	replyTo: () => unknown;
	editing: () => unknown;
};

const SplitThreadHeader = (props: { m: ThreadModel }) => {
	const m = props.m;
	const current = () =>
		m.stack
			.mounted()
			.find(
				(layer): layer is ThreadLayer =>
					layer.kind === "thread" && layer.presentation !== "full",
			);
	return (
		<ChannelHeader
			platform="desktop"
			name={m.unavailable() ? "Unavailable" : m.options.label()}
			icon={<ThreadIcon />}
			actions={
				<>
					<Show when={current()}>
						{(layer) => (
							<IconButton
								variant="ghost"
								size="md"
								label="Expand thread"
								icon={<MaximizeSquareIcon />}
								onClick={() =>
									m.stack.replaceTop({ ...layer(), presentation: "full" })
								}
							/>
						)}
					</Show>
					<IconButton
						variant="ghost"
						size="md"
						label="Close thread"
						icon={<CloseIcon />}
						onClick={() => closePane(m.stack)}
					/>
				</>
			}
		/>
	);
};

const blockingOverlay = '[role="dialog"], [role="menu"], [role="listbox"]';

const FullThreadHeader = (props: { m: ThreadModel }) => {
	const m = props.m;
	const data = useData();
	const shell = useOptionalDesktopShell();
	const parentRef = () => m.parent()?.space;
	const threadIndex = () =>
		m.stack
			.mounted()
			.findLastIndex(
				(layer) => layer.kind === "thread" && layer.presentation === "full",
			);
	const threadsOpen = () => {
		const overlay = shell?.stack.route().overlay;
		return (
			!!overlay &&
			overlay.space === m.options.space &&
			overlay.channel === m.options.channel
		);
	};
	const backToChannel = () => {
		const index = threadIndex();
		if (index >= 0) m.stack.popTo(index);
	};
	const openThreads = () => {
		if (threadsOpen()) return;
		m.stack.push({
			kind: "threads",
			space: m.options.space,
			channel: m.options.channel,
			channelType: m.parent()?.type,
		});
	};
	const threadsUnread = () => {
		const ref = parentRef();
		return (
			!!ref &&
			(data.channel(ref).threads.value() ?? []).some(
				(entry) => entry.viewer.hasUnread,
			)
		);
	};
	const threadRef = () => m.thread()?.space;
	const muted = () => {
		const ref = threadRef();
		return ref ? data.isMuted(ref) : false;
	};
	const setMuted = (next: boolean) => {
		const ref = threadRef();
		if (ref) data.setMuted(ref, next);
	};
	const icon = () => {
		const parent = m.parent();
		return parent && isVoiceChannel(parent) ? <VolumeSmallIcon /> : undefined;
	};
	let idleComposerEscape = false;
	const onKeyDownCapture = (event: KeyboardEvent) => {
		if (event.key !== "Escape") return;
		const target = event.target;
		idleComposerEscape =
			!event.defaultPrevented &&
			target instanceof Element &&
			!!target.closest("[data-composer]") &&
			!document.querySelector(blockingOverlay) &&
			!m.replyTo() &&
			!m.editing();
	};
	const onKeyDown = (event: KeyboardEvent) => {
		if (event.key !== "Escape") return;
		if (event.defaultPrevented && !idleComposerEscape) return;
		if (document.querySelector(blockingOverlay)) return;
		const index = threadIndex();
		if (index < 0 || index !== m.stack.mounted().length - 1) return;
		event.preventDefault();
		backToChannel();
	};
	window.addEventListener("keydown", onKeyDownCapture, true);
	window.addEventListener("keydown", onKeyDown);
	onCleanup(() => {
		window.removeEventListener("keydown", onKeyDownCapture, true);
		window.removeEventListener("keydown", onKeyDown);
	});
	return (
		<ChannelHeader
			platform="desktop"
			name={m.parent()?.name ?? m.options.channel}
			icon={icon()}
			description={m.unavailable() ? undefined : m.options.label()}
			view="threads"
			threadsUnread={threadsUnread()}
			onViewChange={(next) =>
				next === "chat" ? backToChannel() : openThreads()
			}
			muted={muted()}
			onMutedChange={threadRef() ? setMuted : undefined}
			muteSubject="thread"
			membersOpen={shell?.stack.membersOpen()}
			onToggleMembers={
				shell
					? () => shell.stack.setMembersOpen(!shell.stack.membersOpen())
					: undefined
			}
		/>
	);
};

export const thread = defineContract({
	id: "thread",
	model: (args: ThreadArgs) => {
		const data = useData();
		const stack = useStack();
		const community = createMemo(() => data.spaceByKey(args.space));
		const parent = createMemo(() => {
			const current = community();
			return current
				? data.space(current).channelBySlug(args.channel)
				: undefined;
		});
		const view = createMemo(() => {
			const ref = parent()?.space;
			if (!ref) return undefined;
			return data
				.channel(ref)
				.threads.value()
				?.find((entry) => skeyOf(entry.space) === args.thread);
		});
		const conversation = createConversation({
			space: args.space,
			channel: args.channel,
			target: () => view()?.space,
			label: () => view()?.name ?? "Thread",
			thread: view,
			isActive: () =>
				stack.isVisible(
					(layer) => layer.kind === "thread" && layer.thread === args.thread,
				),
		});
		const loadFailure = createMemo(() => {
			const current = community();
			const space = current ? data.space(current) : undefined;
			const channelsError = space?.channels.value()
				? undefined
				: space?.channels.error();
			if (space && channelsError) {
				return {
					error: channelsError,
					retry: () =>
						Promise.all([space.channels.retry(), space.categories.retry()]),
				};
			}
			const ref = parent()?.space;
			if (!ref) return undefined;
			const threads = data.channel(ref).threads;
			const threadsError = threads.value() ? undefined : threads.error();
			if (threadsError) return { error: threadsError, retry: threads.retry };
			const feed = conversation.feed();
			const feedError = feed?.loadError();
			if (feed && feedError) return { error: feedError, retry: feed.reload };
			return undefined;
		});
		const threadUnavailable = createMemo<
			"space" | "channel" | "thread" | undefined
		>(() => {
			if (loadFailure()) return undefined;
			const base = conversation.unavailable();
			if (base) return base;
			const ref = parent()?.space;
			if (!ref) return undefined;
			const threads = data.channel(ref).threads;
			if (threads.loading()) return undefined;
			return view() ? undefined : "thread";
		});
		const menu = createThreadMenu({
			space: args.space,
			channel: args.channel,
			channelType: parent()?.type,
			onDeleted: (deleted) => {
				const top = stack.top();
				if (top?.kind === "thread" && top.thread === skeyOf(deleted.space)) {
					stack.pop();
				}
			},
		});
		const backLabel = () => {
			const layers = stack.mounted();
			const index = layers.findIndex(
				(layer) => layer.kind === "thread" && layer.thread === args.thread,
			);
			const below = index > 0 ? layers[index - 1] : undefined;
			return below && below.kind !== "thread"
				? `Back to #${parent()?.name ?? args.channel}`
				: "Back to channels";
		};
		return {
			...conversation,
			backLabel,
			unavailable: threadUnavailable,
			loadFailure,
			thread: view,
			parent,
			menu,
		};
	},
	slots: {
		Header: slot(
			(m, p: { platform?: "mobile" | "desktop"; full?: boolean }) => (
				<Show
					when={p.platform !== "desktop"}
					fallback={
						<Show when={p.full} fallback={<SplitThreadHeader m={m} />}>
							<FullThreadHeader m={m} />
						</Show>
					}
				>
					<NavHeader
						safeTop
						kind="back"
						navigateLabel={m.backLabel()}
						onNavigate={() => m.stack.pop()}
						title={m.options.label()}
						action={
							m.thread()
								? {
										type: "icon",
										label: "Thread options",
										icon: <MenuDotsIcon />,
										onClick: () => {
											const current = m.thread();
											if (current) m.menu.open(current);
										},
									}
								: undefined
						}
					/>
				</Show>
			),
		),
		Menu: slot((m) => <m.menu.Overlay />),
		Unavailable: slot((m) => (
			<Show when={m.unavailable()}>
				{(kind) => (
					<ConversationUnavailable
						kind={kind()}
						actionLabel={
							kind() === "thread" ? m.backLabel() : "Back to channels"
						}
						onAction={() =>
							kind() === "thread" ? closePane(m.stack) : m.stack.popTo(0)
						}
					/>
				)}
			</Show>
		)),
		LoadError: slot((m) => (
			<Show when={m.loadFailure()} keyed>
				{(failure) => (
					<LoadErrorState
						title="This thread didn't load"
						error={failure.error}
						onRetry={failure.retry}
					/>
				)}
			</Show>
		)),
		Messages: slot((m, p: { platform?: "mobile" | "desktop" }) => (
			<ConversationMessages
				m={m}
				platform={p.platform}
				header={
					<Show when={m.thread()}>
						{(current) => <ThreadIntro thread={current()} />}
					</Show>
				}
			/>
		)),
		Composer: slot((m, p: { platform?: "mobile" | "desktop" }) => (
			<ConversationComposer m={m} platform={p.platform} />
		)),
	},
});
