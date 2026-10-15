import {
	AppShell,
	DiscardChangesDialog,
	StatusScreen,
} from "@colibri-social/ui";
import { ChatSquareDotsIcon } from "@solar-icons/solid/bold/chat-square-dots";
import {
	createEffect,
	createMemo,
	createSignal,
	type JSX,
	lazy,
	onCleanup,
	onMount,
	Show,
	type Signal,
	Suspense,
	untrack,
} from "solid-js";
import { channelSlug, spaceKey } from "../../data/ids";
import { useData } from "../../data/store";
import { TEXT_CHANNEL, VOICE_CHANNEL } from "../../data/types";
import { MemberMenuProvider } from "../../screens/members/member-menu";
import { ProfileSheetProvider } from "../../screens/profile/profile-sheet";
import SpacesScreen from "../../screens/spaces/spaces.screen";
import VoiceScreen from "../../screens/voice/voice.screen";
import { lastViewedSpace } from "../cold-start";
import type { Layer } from "../layers";
import { LoadErrorState, NotFoundScreen } from "../load-error";
import { StackContext } from "../stack";
import {
	DesktopShellContext,
	type OutletName,
	PlacementContext,
} from "./context";
import { Dock } from "./Dock";
import { isModalLayer } from "./desktop-route";
import { createDesktopStack } from "./desktop-stack";
import { ModalHost } from "./modal-areas";
import {
	storedSidebarWidth,
	storedThreadWidth,
	storeSidebarWidth,
	storeThreadWidth,
} from "./sidebar-width";
import { TitleBar } from "./TitleBar";
import { anchorToasts } from "./toast-anchor";

const ChannelScreen = lazy(
	() => import("../../screens/channel/channel.screen"),
);
const MembersScreen = lazy(
	() => import("../../screens/members/members.screen"),
);
const ThreadScreen = lazy(() => import("../../screens/thread/thread.screen"));
const ThreadsScreen = lazy(
	() => import("../../screens/threads/threads.screen"),
);
const ThreadDraftScreen = lazy(
	() => import("../../screens/thread-draft/thread-draft.screen"),
);
const VoiceStage = lazy(() => import("../../screens/voice/desktop-stage"));

const THREAD_WIDTH_SAVE_MS = 250;

const NoChannel = () => (
	<StatusScreen
		tone="neutral"
		icon={<ChatSquareDotsIcon />}
		title="No channel open"
		description="Pick a channel from the list to start chatting."
	/>
);

const AfterPaint = (props: { children: JSX.Element }) => {
	const [ready, setReady] = createSignal(false);
	let timer: ReturnType<typeof setTimeout> | undefined;
	const frame = requestAnimationFrame(() => {
		timer = setTimeout(() => setReady(true));
	});
	onCleanup(() => {
		cancelAnimationFrame(frame);
		clearTimeout(timer);
	});
	return <Show when={ready()}>{props.children}</Show>;
};

export const DesktopShell = () => {
	const data = useData();
	const stack = createDesktopStack();
	onCleanup(stack.dispose);
	const [voiceChatOpen, setVoiceChatOpen] = createSignal(false);
	const outlets: Record<OutletName, Signal<HTMLElement | undefined>> = {
		rail: createSignal<HTMLElement>(),
		header: createSignal<HTMLElement>(),
	};
	const outletSignal = (name: OutletName) => outlets[name];
	const route = stack.route;
	const navigator = stack.navigator;

	const [threadWidth, setThreadWidth] = createSignal(storedThreadWidth());
	let threadWidthTimer: ReturnType<typeof setTimeout> | undefined;
	const saveThreadWidth = () => {
		threadWidthTimer = undefined;
		const width = threadWidth();
		if (width !== undefined) storeThreadWidth(width);
	};
	const changeThreadWidth = (width: number) => {
		setThreadWidth(width);
		if (threadWidthTimer !== undefined) clearTimeout(threadWidthTimer);
		threadWidthTimer = setTimeout(saveThreadWidth, THREAD_WIDTH_SAVE_MS);
	};
	onCleanup(() => {
		if (threadWidthTimer === undefined) return;
		clearTimeout(threadWidthTimer);
		saveThreadWidth();
	});

	createEffect(() => {
		const current = route();
		if (current.chat || current.notFound) return;
		const key = current.root.space;
		const list = data.communities.value();
		if (!list) return;
		const community = key
			? data.spaceByKey(key)
			: (lastViewedSpace(data, list) ?? list[0]);
		if (!community) return;
		const space = data.space(community);
		const channels = space.channels.value();
		if (!channels) return;
		const last = data.lastChannel(spaceKey(community));
		const target =
			channels.find((channel) => channelSlug(channel) === last) ??
			channels.find((channel) => channel.type === TEXT_CHANNEL);
		if (!target) return;
		untrack(() =>
			stack.openBase({
				kind: "chat",
				space: spaceKey(community),
				channel: channelSlug(target),
				channelType: target.type,
			}),
		);
	});

	const modalDepth = () => {
		const layers = navigator.mounted();
		const index = layers.findIndex((layer) => isModalLayer(layer));
		return index === -1 ? layers.length : index;
	};
	const modalLayers = (): Layer[] => navigator.mounted().slice(modalDepth());

	const chat = () => route().chat;
	const fullThread = () => {
		const current = route().pane;
		return current?.kind === "thread" && current.presentation === "full"
			? current
			: undefined;
	};
	const splitPane = () => (fullThread() ? undefined : route().pane);
	const isVoice = () => chat()?.channelType === VOICE_CHANNEL;
	const membersTarget = () => (isVoice() ? undefined : chat());

	const loadFailure = createMemo(() => {
		if (!data.communities.value()) {
			const error = data.communities.error();
			return error
				? {
						error,
						title: "Your Spaces didn't load",
						retry: data.communities.retry,
					}
				: undefined;
		}
		const key = route().root.space;
		const community = key ? data.spaceByKey(key) : undefined;
		if (!community) return undefined;
		const space = data.space(community);
		const error = space.channels.value() ? undefined : space.channels.error();
		return error
			? {
					error,
					title: "Channels didn't load",
					retry: () => {
						space.channels.retry();
						space.categories.retry();
					},
				}
			: undefined;
	});

	const idle = (): JSX.Element => (
		<Show when={loadFailure()} keyed fallback={<NoChannel />}>
			{(failure) => (
				<LoadErrorState
					title={failure.title}
					error={failure.error}
					onRetry={failure.retry}
				/>
			)}
		</Show>
	);

	const main = (): JSX.Element => (
		<div class="relative flex min-h-0 flex-1 flex-col">
			<Show when={route().notFound} keyed>
				{(missing) => <NotFoundScreen path={missing.path} platform="desktop" />}
			</Show>
			<Show when={chat()} keyed fallback={route().notFound ? null : idle()}>
				{(current) => (
					<Suspense>
						<Show
							when={current.channelType === VOICE_CHANNEL}
							fallback={
								<ChannelScreen
									args={{ space: current.space, channel: current.channel }}
								/>
							}
						>
							<VoiceStage space={current.space} channel={current.channel} />
						</Show>
					</Suspense>
				)}
			</Show>
			<Show when={fullThread()} keyed>
				{(layer) => (
					<div
						data-thread-full=""
						class="absolute inset-0 z-10 flex flex-col bg-card"
					>
						<Suspense>
							<ThreadScreen
								args={{
									space: layer.space,
									channel: layer.channel,
									thread: layer.thread,
								}}
							/>
						</Suspense>
					</div>
				)}
			</Show>
			<Show when={route().overlay} keyed>
				{(list) => (
					<div
						data-threads-overlay=""
						class="absolute inset-0 z-20 flex flex-col bg-card"
					>
						<Suspense>
							<ThreadsScreen
								args={{
									space: list.space,
									channel: list.channel,
									channelType: list.channelType,
								}}
							/>
						</Suspense>
					</div>
				)}
			</Show>
		</div>
	);

	const pane = (): JSX.Element | undefined => {
		const current = splitPane();
		const voiceChat = isVoice() && voiceChatOpen() ? chat() : undefined;
		if (!current && !voiceChat) return undefined;
		return (
			<PlacementContext.Provider value="pane">
				<Suspense>
					<Show
						when={splitPane()}
						keyed
						fallback={
							<Show when={voiceChat} keyed>
								{(target) => (
									<ChannelScreen
										args={{ space: target.space, channel: target.channel }}
									/>
								)}
							</Show>
						}
					>
						{(layer) =>
							layer.kind === "thread" ? (
								<ThreadScreen
									args={{
										space: layer.space,
										channel: layer.channel,
										thread: layer.thread,
									}}
								/>
							) : (
								<ThreadDraftScreen
									args={{
										space: layer.space,
										channel: layer.channel,
										channelType: layer.channelType,
										anchor: layer.anchor,
									}}
								/>
							)
						}
					</Show>
				</Suspense>
			</PlacementContext.Provider>
		);
	};

	return (
		<DesktopShellContext.Provider
			value={{
				stack,
				outlet: (name) => outletSignal(name)[0],
				voiceChatOpen,
				setVoiceChatOpen,
				fullThread,
			}}
		>
			<StackContext.Provider value={navigator}>
				<ProfileSheetProvider>
					<MemberMenuProvider>
						<AppShell
							windowBar={<TitleBar />}
							defaultSidebarWidth={storedSidebarWidth()}
							onSidebarWidthCommit={storeSidebarWidth}
							rail={
								<div
									ref={(node) => outletSignal("rail")[1](node)}
									data-outlet="rail"
									class="contents"
								/>
							}
							sidebar={<SpacesScreen args={{ slug: route().root.space }} />}
							dock={
								<div ref={(element) => onMount(() => anchorToasts(element))}>
									<Dock />
								</div>
							}
							header={
								<div
									ref={(node) => outletSignal("header")[1](node)}
									data-outlet="header"
									class="contents"
								/>
							}
							members={
								<Show when={membersTarget()}>
									{(current) => (
										<Suspense>
											<AfterPaint>
												<MembersScreen
													args={{
														get space() {
															return current().space;
														},
														get channel() {
															return current().channel;
														},
													}}
												/>
											</AfterPaint>
										</Suspense>
									)}
								</Show>
							}
							membersOpen={
								stack.membersOpen() && !!chat() && !isVoice() && !splitPane()
							}
							thread={pane()}
							threadWidth={threadWidth()}
							onThreadWidthChange={changeThreadWidth}
						>
							{main()}
						</AppShell>
						<ModalHost layers={modalLayers()} depth={modalDepth()} />
						<VoiceScreen args={{}} />
						<DiscardChangesDialog guard={navigator.leaveGuard} />
					</MemberMenuProvider>
				</ProfileSheetProvider>
			</StackContext.Provider>
		</DesktopShellContext.Provider>
	);
};
