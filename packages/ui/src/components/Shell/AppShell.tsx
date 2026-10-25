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
export const MIN_CHANNEL_SIDEBAR_WIDTH = 200;
export const MAX_CHANNEL_SIDEBAR_WIDTH = 360;
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
	defaultSidebarWidth?: number;
	onSidebarWidthChange?: (width: number) => void;
	onSidebarWidthCommit?: (width: number) => void;
	class?: string;
};

export const clampSidebarWidth = (value: unknown) =>
	typeof value === "number" && Number.isFinite(value)
		? clampPaneWidth(
				value,
				MIN_CHANNEL_SIDEBAR_WIDTH,
				MAX_CHANNEL_SIDEBAR_WIDTH,
			)
		: DEFAULT_CHANNEL_SIDEBAR_WIDTH;

const squareFlushCorner =
	"[[data-app-shell]>:not([data-window-bar-rounded]+*)_&:has([data-banner-flush])]:rounded-tl-none";

const squareChromelessCorner = "[[data-chrome=none]_&]:rounded-tl-none";

const squareSystemFrameCorner =
	"[[data-window-frame=system]_&]:rounded-tl-none";

const flushSystemFrameTop = "[[data-window-frame=system]_&]:border-t-0";

const flushChromelessTop = "[[data-chrome=none]_&]:border-t-0";

export const AppShell = (props: AppShellProps) => {
	const windowBar = createSlot(() => props.windowBar);
	const dock = createSlot(() => props.dock);
	const header = createSlot(() => props.header);
	const members = createSlot(() => props.members);
	const thread = createSlot(() => props.thread);
	const [innerThreadWidth, setInnerThreadWidth] = createSignal(
		clampPaneWidth(props.defaultThreadWidth ?? DEFAULT_THREAD_PANE_WIDTH),
	);
	const [innerSidebarWidth, setInnerSidebarWidth] = createSignal(
		clampSidebarWidth(props.defaultSidebarWidth),
	);
	let root: HTMLDivElement | undefined;

	const sidebarWidth = () => props.sidebarWidth ?? innerSidebarWidth();
	const setSidebarWidth = (width: number) => {
		setInnerSidebarWidth(width);
		props.onSidebarWidthChange?.(width);
	};
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
	const availableSidebarMax = () => {
		const total = root?.clientWidth ?? 0;
		const used =
			SHELL_RAIL_WIDTH +
			MIN_CHAT_WIDTH +
			(membersOpen() ? MEMBER_SIDEBAR_WIDTH : 0) +
			(thread.has() ? threadWidth() : 0);
		return Math.max(MIN_CHANNEL_SIDEBAR_WIDTH, total - used);
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
							class={cx(
								"rail-join relative flex h-full w-(--channel-sidebar-width) min-w-(--channel-sidebar-width) flex-col rounded-tl-sheet border-t border-l border-muted bg-background",
								squareFlushCorner,
								squareChromelessCorner,
								squareSystemFrameCorner,
								flushSystemFrameTop,
								flushChromelessTop,
							)}
						>
							<div
								data-shell-sidebar-content=""
								class={cx(
									"isolate flex min-h-0 flex-1 flex-col overflow-hidden rounded-tl-[calc(var(--radius-sheet)-1px)]",
									squareFlushCorner,
									squareChromelessCorner,
									squareSystemFrameCorner,
								)}
							>
								{props.sidebar}
							</div>
							<PaneResizer
								edge="end"
								label="Resize channel list"
								width={sidebarWidth()}
								onWidthChange={setSidebarWidth}
								onWidthCommit={(width) => props.onSidebarWidthCommit?.(width)}
								min={MIN_CHANNEL_SIDEBAR_WIDTH}
								max={MAX_CHANNEL_SIDEBAR_WIDTH}
								defaultWidth={DEFAULT_CHANNEL_SIDEBAR_WIDTH}
								availableMax={availableSidebarMax}
							/>
						</div>
					</div>
					<Show when={dock.has()}>
						<div
							data-shell-dock=""
							class="relative z-30 w-0 min-w-full shrink-0 px-4 pb-4"
						>
							{dock()}
						</div>
					</Show>
				</div>
				<div
					data-shell-content=""
					class={cx(
						"flex h-full min-w-(--min-chat-width,360px) flex-1 flex-col border-t border-l border-muted bg-card",
						flushSystemFrameTop,
						flushChromelessTop,
					)}
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
