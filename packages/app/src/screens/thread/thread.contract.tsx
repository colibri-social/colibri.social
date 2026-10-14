import {
	ChannelHeader,
	IconButton,
	NavHeader,
	ThreadIcon,
} from "@colibri-social/ui";
import { CloseIcon } from "@solar-icons/solid/bold/close";
import { MaximizeSquareIcon } from "@solar-icons/solid/bold/maximize-square";
import { MenuDotsIcon } from "@solar-icons/solid/bold/menu-dots";
import { createMemo, Show } from "solid-js";
import { skeyOf } from "../../data/ids";
import { useData } from "../../data/store";
import { defineContract, slot } from "../../screen/define";
import { useOptionalDesktopShell } from "../../shell/desktop/context";
import type { ThreadLayer } from "../../shell/layers";
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
	options: { label: () => string; channel: string };
	unavailable: () => string | undefined;
	parent: () => { name: string } | undefined;
};

const DesktopThreadHeader = (props: { m: ThreadModel; full: boolean }) => {
	const m = props.m;
	const shell = useOptionalDesktopShell();
	const current = () =>
		m.stack
			.mounted()
			.find(
				(layer): layer is ThreadLayer =>
					layer.kind === "thread" &&
					layer.presentation === (props.full ? "full" : undefined),
			);
	const channelName = () => m.parent()?.name ?? m.options.channel;
	return (
		<ChannelHeader
			platform="desktop"
			name={m.unavailable() ? "Unavailable" : m.options.label()}
			icon={<ThreadIcon />}
			description={props.full ? `in #${channelName()}` : undefined}
			membersOpen={props.full ? shell?.stack.membersOpen() : undefined}
			onToggleMembers={
				props.full && shell
					? () => shell.stack.setMembersOpen(!shell.stack.membersOpen())
					: undefined
			}
			actions={
				<Show
					when={props.full}
					fallback={
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
				>
					<IconButton
						variant="ghost"
						size="md"
						label={`Back to #${channelName()}`}
						icon={<CloseIcon />}
						onClick={() => closePane(m.stack)}
					/>
				</Show>
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
			isActive: () =>
				stack.isVisible(
					(layer) => layer.kind === "thread" && layer.thread === args.thread,
				),
		});
		const threadUnavailable = createMemo<
			"space" | "channel" | "thread" | undefined
		>(() => {
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
		return {
			...conversation,
			unavailable: threadUnavailable,
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
					fallback={<DesktopThreadHeader m={m} full={!!p.full} />}
				>
					<NavHeader
						safeTop
						kind="back"
						navigateLabel={`Back to #${m.parent()?.name ?? m.options.channel}`}
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
							kind() === "thread"
								? `Back to #${m.parent()?.name ?? m.options.channel}`
								: "Back to channels"
						}
						onAction={() =>
							kind() === "thread" ? closePane(m.stack) : m.stack.popTo(0)
						}
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
