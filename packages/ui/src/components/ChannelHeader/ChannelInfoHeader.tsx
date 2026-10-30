import { ChatSquareDotsIcon } from "@solar-icons/solid/bold/chat-square-dots";
import { ArrowLeftIcon } from "@solar-icons/solid/linear/arrow-left";
import { type JSX, Show } from "solid-js";
import {
	AnimatedBellIcon,
	AnimatedSettingsIcon,
} from "../../icons/animated/icons";
import { cx } from "../../utils/cx";
import { createSlot } from "../../utils/slot";
import { IconButton } from "../IconButton/IconButton";

export type ChannelInfoBarProps = {
	onBack?: () => void;
	backLabel?: string;
	muted?: boolean;
	onMutedChange?: (muted: boolean) => void;
	muteSubject?: "channel" | "thread";
	onOpenSettings?: () => void;
	settingsLabel?: string;
	safeTop?: boolean;
	class?: string;
};

export type ChannelInfoSummaryProps = {
	name: string;
	description?: string;
	icon?: JSX.Element;
	class?: string;
};

export type ChannelInfoHeaderProps = ChannelInfoBarProps &
	Omit<ChannelInfoSummaryProps, "class">;

export const ChannelInfoBar = (props: ChannelInfoBarProps) => (
	<div
		data-channel-info-bar=""
		class={cx(
			"flex h-11 shrink-0 items-center justify-between gap-2 bg-popover px-3 py-1.5 text-foreground",
			props.safeTop &&
				"h-[calc(44px+var(--safe-area-top,0px))] pt-[calc(6px+var(--safe-area-top,0px))] pr-safe-offset-3 pl-safe-offset-3",
			props.class,
		)}
	>
		<Show when={props.onBack} fallback={<span />}>
			<IconButton
				variant="ghost"
				size="md"
				label={props.backLabel ?? "Back"}
				icon={<ArrowLeftIcon />}
				onClick={() => props.onBack?.()}
				class="[&_svg]:size-5"
			/>
		</Show>
		<div class="flex shrink-0 items-center gap-2">
			<Show when={props.onMutedChange}>
				<IconButton
					variant="ghost"
					size="md"
					label={`${props.muted ? "Unmute" : "Mute"} ${props.muteSubject ?? "channel"}`}
					aria-pressed={!!props.muted}
					data-muted={props.muted ? "" : undefined}
					icon={<AnimatedBellIcon muted={!!props.muted} />}
					onClick={() => props.onMutedChange?.(!props.muted)}
					class="[&_svg]:size-5"
				/>
			</Show>
			<Show when={props.onOpenSettings}>
				<IconButton
					variant="ghost"
					size="md"
					label={props.settingsLabel ?? "Channel settings"}
					icon={<AnimatedSettingsIcon />}
					onClick={() => props.onOpenSettings?.()}
					class="[&_svg]:size-5"
				/>
			</Show>
		</div>
	</div>
);

export const ChannelInfoSummary = (props: ChannelInfoSummaryProps) => {
	const icon = createSlot(() => props.icon ?? <ChatSquareDotsIcon />);
	return (
		<div
			data-channel-info-summary=""
			class={cx(
				"flex shrink-0 flex-col gap-2.5 border-b border-secondary bg-popover px-4 py-2 text-foreground",
				props.class,
			)}
		>
			<h1 class="m-0 flex min-w-0 items-center gap-2">
				<span
					aria-hidden="true"
					class="flex size-6 shrink-0 items-center justify-center [&>svg]:size-6"
				>
					{icon()}
				</span>
				<span
					data-channel-info-name=""
					class="min-w-0 truncate text-xl leading-6.5 font-bold"
				>
					{props.name}
				</span>
			</h1>
			<Show when={props.description}>
				{(description) => (
					<p class="m-0 text-sm leading-prose text-muted-foreground">
						{description()}
					</p>
				)}
			</Show>
		</div>
	);
};

export const ChannelInfoHeader = (props: ChannelInfoHeaderProps) => (
	<div data-channel-info-header="" class="flex shrink-0 flex-col">
		<ChannelInfoBar
			onBack={props.onBack}
			backLabel={props.backLabel}
			muted={props.muted}
			onMutedChange={props.onMutedChange}
			muteSubject={props.muteSubject}
			onOpenSettings={props.onOpenSettings}
			settingsLabel={props.settingsLabel}
			safeTop={props.safeTop}
			class={props.class}
		/>
		<ChannelInfoSummary
			name={props.name}
			description={props.description}
			icon={props.icon}
		/>
	</div>
);
