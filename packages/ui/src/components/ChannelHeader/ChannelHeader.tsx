import { ChatSquareDotsIcon } from "@solar-icons/solid/bold/chat-square-dots";
import { AltArrowRightIcon } from "@solar-icons/solid/linear/alt-arrow-right";
import { ArrowLeftIcon } from "@solar-icons/solid/linear/arrow-left";
import { type JSX, Show } from "solid-js";
import { AnimatedBellIcon } from "../../icons/animated/icons";
import { AnimatedThreadIcon } from "../../icons/animated/messaging";
import { cx } from "../../utils/cx";
import { createSlot } from "../../utils/slot";
import { IconButton } from "../IconButton/IconButton";

export type ChannelHeaderPlatform = "mobile" | "desktop";

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
	safeTop?: boolean;
	muted?: boolean;
	onMutedChange?: (muted: boolean) => void;
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

	const title = () => (
		<>
			<ChannelGlyph icon={icon()} size={24} />
			<span
				class="min-w-0 truncate text-xl leading-6.5 font-bold"
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
				"flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background px-3 py-2 text-foreground",
				props.safeTop &&
					"h-[calc(48px+var(--safe-area-top,0px))] pt-safe-offset-2 pr-safe-offset-3 pl-safe-offset-3",
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
					class="[&_svg]:size-6"
				/>
			</Show>
			<h1 class="m-0 flex min-w-0 flex-1">
				<Show
					when={props.onOpenInfo}
					fallback={
						<span class="flex min-w-0 items-center gap-2">{title()}</span>
					}
				>
					<button
						type="button"
						aria-label={props.infoLabel ?? `${props.name}, channel info`}
						onClick={() => props.onOpenInfo?.()}
						class="pressable focus-ring -mx-1 flex min-w-0 cursor-pointer items-center gap-2 rounded-control-sm border border-transparent px-1 text-left enabled:hover:bg-secondary data-pressed:bg-secondary"
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
				<div class="flex shrink-0 items-center gap-2">{actions()}</div>
			</Show>
			<Show when={props.onOpenThreads}>
				<span class="relative inline-flex shrink-0">
					<IconButton
						variant="ghost"
						size="md"
						label={props.threadsUnread ? "Threads, new activity" : "Threads"}
						icon={<AnimatedThreadIcon />}
						onClick={() => props.onOpenThreads?.()}
						class="[&_svg]:size-6"
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
				"flex h-12 shrink-0 items-center justify-between gap-4 border-b border-border bg-background p-2 text-foreground",
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
			<Show when={props.onMutedChange || actions.has()}>
				<div class="flex shrink-0 items-center gap-2">
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
