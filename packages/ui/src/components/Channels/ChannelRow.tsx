import { BellOffIcon } from "@solar-icons/solid/bold/bell-off";
import { ChatSquareDotsIcon } from "@solar-icons/solid/bold/chat-square-dots";
import { FileIcon } from "@solar-icons/solid/bold/file";
import { GalleryMinimalisticIcon } from "@solar-icons/solid/bold/gallery-minimalistic";
import { LockKeyholeMinimalisticIcon } from "@solar-icons/solid/bold/lock-keyhole-minimalistic";
import { SettingsIcon } from "@solar-icons/solid/bold/settings";
import { VolumeIcon } from "@solar-icons/solid/bold/volume";
import { VolumeLoudIcon } from "@solar-icons/solid/bold/volume-loud";
import { VolumeSmallIcon } from "@solar-icons/solid/bold/volume-small";
import { For, type JSX, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { HeadphonesSlashIcon, MicrophoneSlashIcon } from "../../icons/custom";
import { cx } from "../../utils/cx";
import { createLongPress } from "../../utils/gestures";
import { createRipple } from "../../utils/ripple";
import { Avatar } from "../Avatar/Avatar";
import { CountBadge } from "../Badge/Badge";
import type { VoiceParticipant } from "../Voice/shared";

export type ChannelPlatform = "mobile" | "desktop";

export type ChannelPreview = {
	author: string;
	text: string;
};

export type ChannelAttachment = "image" | "file";

export type ChannelRowDensity = "default" | "compact";

type RowEvents = {
	onClick?: (event: MouseEvent) => void;
	onContextMenu?: (event: MouseEvent) => void;
	onLongPress?: (event: PointerEvent) => void;
	onOpenSettings?: () => void;
	settingsLabel?: string;
};

export type ChannelRowProps = RowEvents & {
	name: string;
	href?: string;
	active?: boolean;
	unread?: boolean;
	mentions?: number;
	muted?: boolean;
	private?: boolean;
	preview?: ChannelPreview;
	attachment?: ChannelAttachment;
	platform?: ChannelPlatform;
	density?: ChannelRowDensity;
	class?: string;
};

const rowFocus = "outline-none focus-ring-inset";

const pluralMentions = (count: number) =>
	`${count} ${count === 1 ? "mention" : "mentions"}`;

const bindGestures = (
	events: RowEvents,
	ripple: (element: HTMLElement) => void,
) => {
	return (element: HTMLElement) => {
		ripple(element);
		if (events.onLongPress)
			createLongPress(element, {
				onLongPress: (event) => events.onLongPress?.(event),
			});
	};
};

const SettingsButton = (props: { label: string; onClick: () => void }) => (
	<button
		type="button"
		aria-label={props.label}
		onClick={(event) => {
			event.preventDefault();
			event.stopPropagation();
			props.onClick();
		}}
		data-channel-settings=""
		class="relative z-10 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border-0 bg-transparent p-0 text-muted-foreground opacity-0 outline-none group-hover/channel:opacity-100 group-data-[active]/channel:opacity-100 hover:bg-secondary-highlight hover:text-foreground focus-visible:opacity-100 focus-ring [&>svg]:size-4"
	>
		<SettingsIcon />
	</button>
);

export const ChannelRow = (props: ChannelRowProps) => {
	const ripple = createRipple();
	const mentions = () => props.mentions ?? 0;
	const lit = () =>
		mentions() > 0 || ((!!props.unread || !!props.active) && !props.muted);
	const desktop = () => props.platform === "desktop";
	const compact = () => props.density === "compact";

	return (
		<div
			data-channel-row=""
			data-density={compact() ? "compact" : "default"}
			data-state={
				mentions() > 0 ? "mentions" : props.unread ? "unread" : "read"
			}
			data-active={props.active || undefined}
			data-muted={props.muted || undefined}
			class={cx(
				"group/channel relative flex w-full items-start gap-2",
				props.class,
			)}
		>
			<Dynamic
				component={props.href ? "a" : "button"}
				ref={bindGestures(props, ripple)}
				type={props.href ? undefined : "button"}
				href={props.href}
				aria-current={props.active ? "page" : undefined}
				onClick={(event: MouseEvent) => props.onClick?.(event)}
				onContextMenu={(event: MouseEvent) => props.onContextMenu?.(event)}
				class={cx(
					"ripple flex w-full min-w-0 cursor-pointer flex-col justify-center gap-1 rounded-control-sm border-0 bg-transparent px-2 py-1.5 text-left no-underline select-none [-webkit-touch-callout:none]",
					compact() && "h-8",
					"hover:bg-popover/60",
					rowFocus,
					desktop() && props.active && "bg-popover hover:bg-popover",
				)}
			>
				<span class="flex h-5 w-full min-w-0 items-center gap-2">
					<span
						class={cx(
							"flex size-4 shrink-0 [&>svg]:size-4",
							lit() ? "text-foreground" : "text-muted-foreground",
							props.muted && "opacity-60",
						)}
					>
						<ChatSquareDotsIcon />
					</span>
					<span
						data-channel-name=""
						class={cx(
							"min-w-0 flex-1 truncate text-base leading-5",
							lit()
								? "font-semibold text-foreground"
								: "font-medium text-muted-foreground",
						)}
					>
						{props.name}
					</span>
					<Show when={props.private}>
						<span
							role="img"
							aria-label="Private"
							class="flex size-3 shrink-0 text-muted-foreground [&>svg]:size-3"
						>
							<LockKeyholeMinimalisticIcon />
						</span>
					</Show>
					<Show when={props.muted}>
						<span
							role="img"
							aria-label="Muted"
							class="flex size-3 shrink-0 text-muted-foreground [&>svg]:size-3"
						>
							<BellOffIcon />
						</span>
					</Show>
					<Show when={mentions() > 0}>
						<CountBadge
							data-channel-mentions=""
							aria-hidden="true"
							count={mentions()}
							max={9}
						/>
						<span class="sr-only">{`, ${pluralMentions(mentions())}`}</span>
					</Show>
					<Show when={!mentions() && props.unread}>
						<span class="sr-only">, unread</span>
					</Show>
					<Show when={desktop() && props.onOpenSettings}>
						<span aria-hidden="true" class="h-5 w-5 shrink-0" />
					</Show>
				</span>
				<Show when={!compact() && props.preview}>
					{(preview) => (
						<span class="flex h-4 w-full min-w-0 items-center justify-between gap-2">
							<span
								data-channel-preview=""
								class="min-w-0 flex-1 truncate text-xs leading-4 text-muted-foreground"
							>
								<span
									class={cx(
										"font-medium",
										lit() ? "text-foreground" : "text-muted-foreground",
									)}
								>
									{preview().author}
								</span>
								{`: ${preview().text}`}
							</span>
							<Show when={props.attachment}>
								{(kind) => (
									<span
										role="img"
										aria-label={
											kind() === "image"
												? "Image attachment"
												: "File attachment"
										}
										class="flex size-4 shrink-0 text-muted-foreground [&>svg]:size-4"
									>
										<Show when={kind() === "image"} fallback={<FileIcon />}>
											<GalleryMinimalisticIcon />
										</Show>
									</span>
								)}
							</Show>
						</span>
					)}
				</Show>
			</Dynamic>
			<Show when={desktop() && props.onOpenSettings}>
				<span class="absolute top-1 right-1 flex">
					<SettingsButton
						label={props.settingsLabel ?? `Settings for ${props.name}`}
						onClick={() => props.onOpenSettings?.()}
					/>
				</span>
			</Show>
		</div>
	);
};

export type VoiceChannelRowProps = RowEvents & {
	name: string;
	href?: string;
	joined?: boolean;
	active?: boolean;
	muted?: boolean;
	private?: boolean;
	participants?: VoiceParticipant[];
	platform?: ChannelPlatform;
	class?: string;
};

export const voiceIconState = (props: {
	joined?: boolean;
	participants?: VoiceParticipant[];
}) =>
	props.joined
		? "joined"
		: (props.participants?.length ?? 0) > 0
			? "active"
			: "empty";

const joinedHighlight =
	"linear-gradient(90deg, color-mix(in srgb, var(--primary) 32%, transparent), color-mix(in srgb, var(--primary) 6%, transparent))";

export const VoiceChannelRow = (props: VoiceChannelRowProps) => {
	const ripple = createRipple();
	const state = () => voiceIconState(props);
	const participants = () => props.participants ?? [];
	const desktop = () => props.platform === "desktop";

	return (
		<div
			data-voice-row=""
			data-state={state()}
			data-joined={props.joined || undefined}
			class={cx("group/channel relative flex w-full flex-col", props.class)}
		>
			<Dynamic
				component={props.href ? "a" : "button"}
				ref={bindGestures(props, ripple)}
				type={props.href ? undefined : "button"}
				href={props.href}
				aria-current={props.active ? "page" : undefined}
				onClick={(event: MouseEvent) => props.onClick?.(event)}
				onContextMenu={(event: MouseEvent) => props.onContextMenu?.(event)}
				class={cx(
					"ripple flex h-8 w-full min-w-0 cursor-pointer items-center gap-2 rounded-r-control-xs border-0 border-l-2 border-solid bg-transparent p-1.5 text-left no-underline select-none [-webkit-touch-callout:none]",
					rowFocus,
					props.joined
						? "rounded-r-control-sm border-primary"
						: "border-transparent hover:bg-popover/60",
					desktop() && props.active && !props.joined && "bg-popover",
				)}
				style={
					props.joined ? { "background-image": joinedHighlight } : undefined
				}
			>
				<span
					class={cx(
						"flex size-4 shrink-0 [&>svg]:size-4",
						state() === "empty" ? "text-muted-foreground" : "text-primary",
					)}
				>
					<Show
						when={state() === "joined"}
						fallback={
							<Show when={state() === "active"} fallback={<VolumeIcon />}>
								<VolumeSmallIcon />
							</Show>
						}
					>
						<VolumeLoudIcon />
					</Show>
				</span>
				<span
					data-channel-name=""
					class={cx(
						"min-w-0 flex-1 truncate text-base leading-5 font-semibold",
						props.joined ? "text-foreground" : "text-muted-foreground",
					)}
				>
					{props.name}
				</span>
				<Show when={props.private}>
					<span
						role="img"
						aria-label="Private"
						class="flex size-3 shrink-0 text-muted-foreground [&>svg]:size-3"
					>
						<LockKeyholeMinimalisticIcon />
					</span>
				</Show>
				<Show when={props.joined}>
					<span class="sr-only">, connected</span>
				</Show>
				<Show when={participants().length > 0}>
					<span class="sr-only">{`, ${participants().length} in voice`}</span>
				</Show>
				<Show when={desktop() && props.onOpenSettings}>
					<span aria-hidden="true" class="h-5 w-5 shrink-0" />
				</Show>
			</Dynamic>
			<Show when={desktop() && props.onOpenSettings}>
				<span class="absolute top-1 right-1 flex h-6 items-center">
					<SettingsButton
						label={props.settingsLabel ?? `Settings for ${props.name}`}
						onClick={() => props.onOpenSettings?.()}
					/>
				</span>
			</Show>
			<Show when={participants().length > 0}>
				<ul
					aria-label={`In ${props.name}`}
					data-voice-participants=""
					class={cx(
						"m-0 flex list-none flex-col gap-1 border-0 border-l-2 border-solid pt-1 pr-0 pb-0 pl-6",
						props.joined ? "border-primary" : "border-transparent",
					)}
				>
					<For each={participants()}>
						{(person) => <ParticipantRow person={person} />}
					</For>
				</ul>
			</Show>
		</div>
	);
};

const ParticipantRow = (props: { person: VoiceParticipant }) => (
	<li
		data-voice-participant=""
		data-speaking={props.person.speaking || undefined}
		class="flex min-w-0 items-center gap-2 p-1"
	>
		<span
			data-speaking-ring=""
			class={cx(
				"flex shrink-0 rounded-full",
				props.person.speaking &&
					"outline-[1.5px] outline-offset-1 outline-primary outline-solid",
			)}
		>
			<Avatar
				name={props.person.name}
				src={props.person.avatarSrc}
				color={props.person.color}
				size="sm"
				aria-hidden="true"
			/>
		</span>
		<span class="min-w-0 flex-1 truncate text-base leading-5 font-semibold text-muted-foreground">
			{props.person.name}
		</span>
		<Show when={props.person.speaking}>
			<span class="sr-only">, speaking</span>
		</Show>
		<Show when={props.person.deafened}>
			<span
				role="img"
				aria-label="Deafened"
				class="flex size-4 shrink-0 text-muted-foreground [&>svg]:size-4"
			>
				<HeadphonesSlashIcon />
			</span>
		</Show>
		<Show when={props.person.muted && !props.person.deafened}>
			<span
				role="img"
				aria-label="Muted"
				class="flex size-4 shrink-0 text-muted-foreground [&>svg]:size-4"
			>
				<MicrophoneSlashIcon />
			</span>
		</Show>
	</li>
);

export type ChannelListEmptyProps = { children?: JSX.Element };

export const CategoryEmpty = (props: ChannelListEmptyProps) => (
	<span class="px-2 py-1.5 text-xs text-muted-foreground">
		{props.children ?? "This category is empty."}
	</span>
);
