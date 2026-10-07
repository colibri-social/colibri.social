import { createSignal, type JSX, onCleanup, onMount, Show } from "solid-js";
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
	const members = createSlot(() => props.members);
	const thread = createSlot(() => props.thread);
	const [dockHeight, setDockHeight] = createSignal(0);
	const [innerThreadWidth, setInnerThreadWidth] = createSignal(
		clampPaneWidth(props.defaultThreadWidth ?? DEFAULT_THREAD_PANE_WIDTH),
	);
	let root: HTMLDivElement | undefined;
	let dockBox: HTMLDivElement | undefined;

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

	onMount(() => {
		if (!dockBox) return;
		const observer = new ResizeObserver(([entry]) =>
			setDockHeight(entry?.borderBoxSize[0]?.blockSize ?? 0),
		);
		observer.observe(dockBox);
		onCleanup(() => observer.disconnect());
	});

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
				"--shell-dock-space": dock.has() ? `${dockHeight() + 32}px` : "0px",
			}}
		>
			<Show when={windowBar.has()}>{windowBar()}</Show>
			<div class="flex min-h-0 flex-1">
				<div
					data-shell-navigation=""
					class="relative flex h-full shrink-0 border-r border-border"
				>
					<nav
						aria-label="Spaces"
						data-shell-rail=""
						class="flex h-full w-(--shell-rail-width) shrink-0 flex-col border-r border-border pb-(--shell-dock-space)"
					>
						{props.rail}
					</nav>
					<div
						data-shell-sidebar=""
						class="flex h-full w-(--channel-sidebar-width) min-w-(--channel-sidebar-width) flex-col pb-(--shell-dock-space)"
					>
						{props.sidebar}
					</div>
					<Show when={dock.has()}>
						<div
							ref={dockBox}
							data-shell-dock=""
							class="absolute right-4 bottom-4 left-4 z-30"
						>
							{dock()}
						</div>
					</Show>
				</div>
				<main
					data-shell-main=""
					class="flex h-full min-w-(--min-chat-width,360px) flex-1 flex-col bg-card"
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
	);
};
