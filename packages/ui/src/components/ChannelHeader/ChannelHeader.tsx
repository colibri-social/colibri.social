import { ChatSquareDotsIcon } from "@solar-icons/solid/bold/chat-square-dots";
import { AltArrowRightIcon } from "@solar-icons/solid/linear/alt-arrow-right";
import { ArrowLeftIcon } from "@solar-icons/solid/linear/arrow-left";
import { type JSX, Show } from "solid-js";
import { AnimatedBellIcon } from "../../icons/animated/icons";
import { AnimatedThreadIcon } from "../../icons/animated/messaging";
import { AnimatedUsersGroupTwoRoundedIcon } from "../../icons/animated/people";
import { cx } from "../../utils/cx";
import { createRipple } from "../../utils/ripple";
import { createSlot } from "../../utils/slot";
import { IconButton, iconButtonTouchTarget } from "../IconButton/IconButton";
import { SegmentedControl } from "../SegmentedControl/SegmentedControl";

export type ChannelHeaderPlatform = "mobile" | "desktop";

export type ChannelHeaderView = "chat" | "threads";

export type ChannelHeaderProps = {
	name: string;
	platform?: ChannelHeaderPlatform;
	icon?: JSX.Element;
	description?: string;
	onBack?: () => void;
	backLabel?: string;
	onOpenInfo?: () => void;
	infoLabel?: string;
	onOpenThreads?: () => void;
	threadsUnread?: boolean;
	view?: ChannelHeaderView;
	onViewChange?: (view: ChannelHeaderView) => void;
	safeTop?: boolean;
	muted?: boolean;
	onMutedChange?: (muted: boolean) => void;
	membersOpen?: boolean;
	onToggleMembers?: () => void;
	actions?: JSX.Element;
	class?: string;
};

const ChannelGlyph = (props: { icon: JSX.Element; size: 20 | 24 }) => (
	<span
		aria-hidden="true"
		class={cx(
			"flex shrink-0 items-center justify-center",
			props.size === 24 ? "size-6 [&>svg]:size-6" : "size-5 [&>svg]:size-5",
		)}
	>
		{props.icon}
	</span>
);

const MobileChannelHeader = (props: ChannelHeaderProps) => {
	const icon = createSlot(() => props.icon ?? <ChatSquareDotsIcon />);
	const actions = createSlot(() => props.actions);
	const ripple = createRipple();
	const trigger = () => props.onToggleMembers ?? props.onOpenInfo;
	const triggerLabel = () => {
		if (props.onToggleMembers) {
			return props.membersOpen
				? `${props.name}, hide members`
				: `${props.name}, show members`;
		}
		return props.infoLabel ?? `${props.name}, channel info`;
	};

	const title = () => (
		<>
			<ChannelGlyph icon={icon()} size={20} />
			<span
				class="min-w-0 truncate text-base leading-5 font-bold"
				title={props.name}
			>
				{props.name}
			</span>
		</>
	);

	return (
		<div
			data-channel-header="mobile"
			class={cx(
				"flex h-11 shrink-0 items-center gap-3 border-b border-border bg-background px-3 py-1.5 text-foreground",
				props.safeTop &&
					"h-[calc(44px+var(--safe-area-top,0px))] pt-[calc(6px+var(--safe-area-top,0px))] pr-safe-offset-3 pl-safe-offset-3",
				props.class,
			)}
		>
			<Show when={props.onBack}>
				<IconButton
					variant="ghost"
					size="md"
					label={props.backLabel ?? "Back"}
					icon={<ArrowLeftIcon />}
					onClick={() => props.onBack?.()}
					class={iconButtonTouchTarget}
				/>
			</Show>
			<h1 class="m-0 flex h-full min-w-0 flex-1">
				<Show
					when={trigger()}
					fallback={
						<span class="flex min-w-0 items-center gap-2">{title()}</span>
					}
				>
					<button
						ref={ripple}
						type="button"
						data-channel-header-trigger=""
						aria-label={triggerLabel()}
						aria-pressed={
							props.onToggleMembers ? !!props.membersOpen : undefined
						}
						onClick={() => trigger()?.()}
						class="ripple pressable focus-ring -ml-1 flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-control-sm border border-transparent px-1 text-left"
					>
						{title()}
						<AltArrowRightIcon
							aria-hidden="true"
							class="size-4 shrink-0 text-muted-foreground"
						/>
					</button>
				</Show>
			</h1>
			<Show when={actions.has()}>
				<div class="flex shrink-0 items-center gap-3">{actions()}</div>
			</Show>
			<Show when={props.onOpenThreads}>
				<span class="relative inline-flex shrink-0">
					<IconButton
						variant="ghost"
						size="md"
						label={props.threadsUnread ? "Threads, new activity" : "Threads"}
						icon={<AnimatedThreadIcon />}
						onClick={() => props.onOpenThreads?.()}
						class={iconButtonTouchTarget}
					/>
					<Show when={props.threadsUnread}>
						<span
							aria-hidden="true"
							data-threads-unread=""
							class="pointer-events-none absolute top-1 right-1 size-2 rounded-full bg-foreground ring-2 ring-background"
						/>
					</Show>
				</span>
			</Show>
		</div>
	);
};

const DesktopChannelHeader = (props: ChannelHeaderProps) => {
	const icon = createSlot(() => props.icon ?? <ChatSquareDotsIcon />);
	const actions = createSlot(() => props.actions);

	return (
		<div
			data-channel-header="desktop"
			class={cx(
				"flex h-12 shrink-0 items-center justify-between gap-4 border-b border-muted bg-card p-2 text-foreground",
				props.safeTop &&
					"h-[calc(48px+var(--safe-area-top,0px))] pt-safe-offset-2 pr-safe-offset-2 pl-safe-offset-2",
				props.class,
			)}
		>
			<div class="flex min-w-0 flex-1 items-center gap-2 pl-1">
				<ChannelGlyph icon={icon()} size={20} />
				<h1
					class="m-0 min-w-0 shrink truncate text-base leading-5 font-semibold"
					title={props.name}
				>
					{props.name}
				</h1>
				<Show when={props.description}>
					{(description) => (
						<>
							<span aria-hidden="true" class="shrink-0 text-muted-foreground">
								·
							</span>
							<p
								class="m-0 min-w-0 flex-1 truncate text-base leading-5 text-muted-foreground"
								title={description()}
							>
								{description()}
							</p>
						</>
					)}
				</Show>
			</div>
			<Show
				when={
					props.onViewChange ||
					props.onOpenThreads ||
					props.onMutedChange ||
					props.onToggleMembers ||
					actions.has()
				}
			>
				<div class="flex shrink-0 items-center gap-2">
					<Show when={props.onViewChange}>
						{(change) => (
							<SegmentedControl
								size="sm"
								aria-label="Channel view"
								class="w-auto"
								value={props.view ?? "chat"}
								onChange={(value) => change()(value as ChannelHeaderView)}
								options={[
									{ value: "chat", label: "Chat" },
									{
										value: "threads",
										label: (
											<span class="flex items-center gap-1.5">
												Threads
												<Show when={props.threadsUnread}>
													<span
														aria-hidden="true"
														data-threads-unread=""
														class="size-1.5 shrink-0 rounded-full bg-foreground"
													/>
													<span class="sr-only">, new activity</span>
												</Show>
											</span>
										),
									},
								]}
							/>
						)}
					</Show>
					<Show when={props.onOpenThreads && !props.onViewChange}>
						<span class="relative inline-flex shrink-0">
							<IconButton
								variant="ghost"
								size="md"
								label={
									props.threadsUnread ? "Threads, new activity" : "Threads"
								}
								icon={<AnimatedThreadIcon />}
								onClick={() => props.onOpenThreads?.()}
							/>
							<Show when={props.threadsUnread}>
								<span
									aria-hidden="true"
									data-threads-unread=""
									class="pointer-events-none absolute top-1 right-1 size-2 rounded-full bg-foreground ring-2 ring-background"
								/>
							</Show>
						</span>
					</Show>
					<Show when={props.onMutedChange}>
						<IconButton
							variant="ghost"
							size="md"
							label={props.muted ? "Unmute channel" : "Mute channel"}
							aria-pressed={!!props.muted}
							data-muted={props.muted ? "" : undefined}
							icon={<AnimatedBellIcon muted={!!props.muted} />}
							onClick={() => props.onMutedChange?.(!props.muted)}
						/>
					</Show>
					<Show when={props.onToggleMembers}>
						<IconButton
							variant="ghost"
							size="md"
							label={props.membersOpen ? "Hide members" : "Show members"}
							aria-pressed={!!props.membersOpen}
							icon={<AnimatedUsersGroupTwoRoundedIcon />}
							onClick={() => props.onToggleMembers?.()}
						/>
					</Show>
					{actions()}
				</div>
			</Show>
		</div>
	);
};

export const ChannelHeader = (props: ChannelHeaderProps) => (
	<Show
		when={(props.platform ?? "mobile") === "desktop"}
		fallback={<MobileChannelHeader {...props} />}
	>
		<DesktopChannelHeader {...props} />
	</Show>
);
