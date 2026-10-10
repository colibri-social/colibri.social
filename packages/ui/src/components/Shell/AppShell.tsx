import { createSignal, type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { createSlot } from "../../utils/slot";
import {
	clampPaneWidth,
	DEFAULT_THREAD_PANE_WIDTH,
	MAX_THREAD_PANE_WIDTH,
	MIN_THREAD_PANE_WIDTH,
	PaneResizer,
} from "./PaneResizer";

export const SHELL_RAIL_WIDTH = 56;
export const DEFAULT_CHANNEL_SIDEBAR_WIDTH = 288;
export const MEMBER_SIDEBAR_WIDTH = 288;
export const MIN_CHAT_WIDTH = 360;

export type AppShellProps = {
	windowBar?: JSX.Element;
	rail: JSX.Element;
	railLabel?: string;
	header?: JSX.Element;
	sidebar: JSX.Element;
	dock?: JSX.Element;
	children: JSX.Element;
	members?: JSX.Element;
	membersOpen?: boolean;
	thread?: JSX.Element;
	threadWidth?: number;
	defaultThreadWidth?: number;
	onThreadWidthChange?: (width: number) => void;
	sidebarWidth?: number;
	class?: string;
};

export const AppShell = (props: AppShellProps) => {
	const windowBar = createSlot(() => props.windowBar);
	const dock = createSlot(() => props.dock);
	const header = createSlot(() => props.header);
	const members = createSlot(() => props.members);
	const thread = createSlot(() => props.thread);
	const [innerThreadWidth, setInnerThreadWidth] = createSignal(
		clampPaneWidth(props.defaultThreadWidth ?? DEFAULT_THREAD_PANE_WIDTH),
	);
	let root: HTMLDivElement | undefined;

	const sidebarWidth = () =>
		props.sidebarWidth ?? DEFAULT_CHANNEL_SIDEBAR_WIDTH;
	const membersOpen = () => members.has() && props.membersOpen !== false;
	const threadWidth = () => props.threadWidth ?? innerThreadWidth();
	const setThreadWidth = (width: number) => {
		setInnerThreadWidth(width);
		props.onThreadWidthChange?.(width);
	};
	const availableThreadMax = () => {
		const total = root?.clientWidth ?? 0;
		const used =
			SHELL_RAIL_WIDTH +
			sidebarWidth() +
			MIN_CHAT_WIDTH +
			(membersOpen() ? MEMBER_SIDEBAR_WIDTH : 0);
		return Math.max(MIN_THREAD_PANE_WIDTH, total - used);
	};

	return (
		<div
			ref={root}
			data-app-shell=""
			class={cx(
				"flex h-dvh w-full flex-col overflow-hidden bg-background px-safe pb-safe text-foreground",
				props.class,
			)}
			style={{
				"--shell-rail-width": `${SHELL_RAIL_WIDTH}px`,
				"--channel-sidebar-width": `${sidebarWidth()}px`,
				"--members-width": `${MEMBER_SIDEBAR_WIDTH}px`,
			}}
		>
			<Show when={windowBar.has()}>{windowBar()}</Show>
			<div class="flex min-h-0 flex-1">
				<div
					data-shell-navigation=""
					data-space-rail-host=""
					class="relative flex h-full shrink-0 flex-col"
				>
					<div data-shell-navigation-top="" class="flex min-h-0 flex-1">
						<nav
							aria-label={props.railLabel ?? "Main"}
							data-shell-rail=""
							class="flex h-full w-(--shell-rail-width) shrink-0 flex-col"
						>
							{props.rail}
						</nav>
						<div
							data-shell-sidebar=""
							class="rail-join relative flex h-full w-(--channel-sidebar-width) min-w-(--channel-sidebar-width) flex-col rounded-tl-sheet border-t border-l border-muted bg-background"
						>
							<div
								data-shell-sidebar-content=""
								class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-tl-[calc(var(--radius-sheet)-1px)]"
							>
								{props.sidebar}
							</div>
						</div>
					</div>
					<Show when={dock.has()}>
						<div data-shell-dock="" class="relative z-30 shrink-0 px-4 pb-4">
							{dock()}
						</div>
					</Show>
				</div>
				<div
					data-shell-content=""
					class="flex h-full min-w-(--min-chat-width,360px) flex-1 flex-col border-t border-l border-muted bg-card"
				>
					<Show when={header.has()}>
						<div data-shell-header="" class="shrink-0">
							{header()}
						</div>
					</Show>
					<div data-shell-body="" class="flex min-h-0 flex-1">
						<main
							data-shell-main=""
							class="flex h-full min-w-0 flex-1 flex-col bg-card"
						>
							{props.children}
						</main>
						<Show when={thread.has()}>
							<aside
								aria-label="Thread"
								data-shell-thread=""
								class="relative flex h-full shrink-0 flex-col border-l border-border bg-card"
								style={{ width: `${threadWidth()}px` }}
							>
								<PaneResizer
									width={threadWidth()}
									onWidthChange={setThreadWidth}
									min={MIN_THREAD_PANE_WIDTH}
									max={MAX_THREAD_PANE_WIDTH}
									defaultWidth={props.defaultThreadWidth}
									availableMax={availableThreadMax}
								/>
								{thread()}
							</aside>
						</Show>
						<Show when={membersOpen()}>
							<aside
								aria-label="Members"
								data-shell-members=""
								class="flex h-full w-(--members-width) min-w-(--members-width) shrink-0 flex-col border-l border-border bg-card"
							>
								{members()}
							</aside>
						</Show>
					</div>
				</div>
			</div>
		</div>
	);
};
