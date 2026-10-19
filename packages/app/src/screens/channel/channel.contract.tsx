import type { ColibriError } from "@colibri-social/lib";
import {
	ChannelHeader,
	ConversationStart,
	IconButton,
} from "@colibri-social/ui";
import { CloseIcon } from "@solar-icons/solid/bold/close";
import { VolumeSmallIcon } from "@solar-icons/solid/bold/volume-small";
import { createMemo, Show } from "solid-js";
import { isVoiceChannel } from "../../data/ids";
import { useData } from "../../data/store";
import { VOICE_CHANNEL } from "../../data/types";
import { defineContract, slot } from "../../screen/define";
import {
	type Placement,
	useOptionalDesktopShell,
} from "../../shell/desktop/context";
import { LoadErrorState } from "../../shell/load-error";
import { useStack } from "../../shell/stack";
import {
	type Conversation,
	ConversationComposer,
	ConversationMessages,
	ConversationUnavailable,
	createConversation,
} from "./conversation";

export type ChannelArgs = {
	space: string;
	channel: string;
	channelType?: string;
};

type ChannelModel = Conversation & {
	loadFailure: () => LoadFailure | undefined;
	voice: () => boolean;
};

type LoadFailure = { error: ColibriError; retry: () => void };

const channelIcon = (m: ChannelModel) =>
	m.voice() ? <VolumeSmallIcon /> : undefined;

const openThreads = (m: ChannelModel) =>
	m.stack.push({
		kind: "threads",
		space: m.options.space,
		channel: m.options.channel,
		channelType: m.view()?.type,
	});

const threadsUnread = (m: ChannelModel) =>
	(m.feed()?.threads.value() ?? []).some((thread) => thread.viewer.hasUnread);

const MobileHeader = (props: { m: ChannelModel }) => {
	const m = props.m;
	return (
		<ChannelHeader
			platform="mobile"
			safeTop
			name={m.unavailable() ? "Unavailable" : m.options.label()}
			icon={channelIcon(m)}
			description={m.view()?.description}
			onBack={() => m.stack.pop()}
			backLabel="Back to channels"
			muted={m.muted()}
			onMutedChange={m.unavailable() ? undefined : m.setMuted}
			onOpenThreads={m.unavailable() ? undefined : () => openThreads(m)}
			threadsUnread={threadsUnread(m)}
			onToggleMembers={
				m.unavailable()
					? undefined
					: () =>
							m.stack.push({
								kind: "members",
								space: m.options.space,
								channel: m.options.channel,
							})
			}
		/>
	);
};

const DesktopHeader = (props: { m: ChannelModel; placement: Placement }) => {
	const m = props.m;
	const shell = useOptionalDesktopShell();
	const inPane = () => props.placement === "pane";
	const threadsOpen = () => {
		const overlay = shell?.stack.route().overlay;
		return (
			!!overlay &&
			overlay.space === m.options.space &&
			overlay.channel === m.options.channel
		);
	};
	return (
		<ChannelHeader
			platform="desktop"
			name={m.unavailable() ? "Unavailable" : m.options.label()}
			icon={channelIcon(m)}
			description={inPane() ? undefined : m.view()?.description}
			muted={m.muted()}
			onMutedChange={m.unavailable() || inPane() ? undefined : m.setMuted}
			view={threadsOpen() ? "threads" : "chat"}
			threadsUnread={threadsUnread(m)}
			onViewChange={
				m.unavailable() || inPane()
					? undefined
					: (next) => {
							if (next === "threads" && !threadsOpen()) openThreads(m);
							if (next === "chat" && threadsOpen()) m.stack.pop();
						}
			}
			membersOpen={shell?.stack.membersOpen()}
			onToggleMembers={
				m.unavailable() ||
				inPane() ||
				!shell ||
				(!!shell.stack.route().pane && !shell.fullThread())
					? undefined
					: () => shell.stack.setMembersOpen(!shell.stack.membersOpen())
			}
			actions={
				inPane() && shell ? (
					<IconButton
						variant="ghost"
						size="md"
						label="Close voice chat"
						icon={<CloseIcon />}
						onClick={() => shell.setVoiceChatOpen(false)}
					/>
				) : undefined
			}
		/>
	);
};

export const channel = defineContract({
	id: "channel",
	model: (args: ChannelArgs) => {
		const data = useData();
		const stack = useStack();
		const community = createMemo(() => data.spaceByKey(args.space));
		const view = createMemo(() => {
			const current = community();
			return current
				? data.space(current).channelBySlug(args.channel)
				: undefined;
		});
		const conversation = createConversation({
			space: args.space,
			channel: args.channel,
			target: () => view()?.space,
			label: () => view()?.name ?? args.channel,
			isActive: () =>
				stack.isVisible(
					(layer) =>
						layer.kind === "chat" &&
						layer.space === args.space &&
						layer.channel === args.channel,
				),
		});
		const loadFailure = createMemo<LoadFailure | undefined>(() => {
			const current = community();
			const space = current ? data.space(current) : undefined;
			const channelsError = space?.channels.error();
			if (space && channelsError) {
				return {
					error: channelsError,
					retry: () => {
						space.channels.retry();
						space.categories.retry();
					},
				};
			}
			const feed = conversation.feed();
			const feedError = feed?.loadError();
			if (feed && feedError) return { error: feedError, retry: feed.reload };
			return undefined;
		});
		const voice = () => {
			const current = view();
			return current
				? isVoiceChannel(current)
				: args.channelType === VOICE_CHANNEL;
		};
		const model: ChannelModel = { ...conversation, loadFailure, voice };
		return model;
	},
	slots: {
		Header: slot(
			(m, p: { platform?: "mobile" | "desktop"; placement?: Placement }) => (
				<Show when={p.platform === "desktop"} fallback={<MobileHeader m={m} />}>
					<DesktopHeader m={m} placement={p.placement ?? "main"} />
				</Show>
			),
		),
		Unavailable: slot((m) => (
			<Show when={m.unavailable()}>
				{(kind) => (
					<ConversationUnavailable
						kind={kind()}
						voice={m.voice()}
						actionLabel="Back to channels"
						onAction={() => m.stack.pop()}
					/>
				)}
			</Show>
		)),
		LoadError: slot((m) => (
			<Show when={m.loadFailure()} keyed>
				{(failure) => (
					<LoadErrorState
						title="This channel didn't load"
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
					<Show when={m.view()}>
						{(current) => (
							<ConversationStart
								kind="channel"
								name={current().name}
								description={current().description}
								icon={
									isVoiceChannel(current()) ? <VolumeSmallIcon /> : undefined
								}
							/>
						)}
					</Show>
				}
			/>
		)),
		Composer: slot((m, p: { platform?: "mobile" | "desktop" }) => (
			<ConversationComposer m={m} platform={p.platform} />
		)),
	},
});
