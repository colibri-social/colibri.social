import { BellOffIcon } from "@solar-icons/solid/bold/bell-off";
import { ChatRoundDotsIcon } from "@solar-icons/solid/bold/chat-round-dots";
import { ChatSquareDotsIcon } from "@solar-icons/solid/bold/chat-square-dots";
import { FileIcon } from "@solar-icons/solid/bold/file";
import { GalleryMinimalisticIcon } from "@solar-icons/solid/bold/gallery-minimalistic";
import { LockKeyholeMinimalisticIcon } from "@solar-icons/solid/bold/lock-keyhole-minimalistic";
import { SettingsIcon } from "@solar-icons/solid/bold/settings";
import { VolumeIcon } from "@solar-icons/solid/bold/volume";
import { VolumeLoudIcon } from "@solar-icons/solid/bold/volume-loud";
import { VolumeSmallIcon } from "@solar-icons/solid/bold/volume-small";
import { For, type JSX, Show, untrack } from "solid-js";
import { Dynamic } from "solid-js/web";
import {
	HeadphonesSlashIcon,
	MicrophoneSlashIcon,
	ThreadIcon,
} from "../../icons/custom";
import { cx } from "../../utils/cx";
import { createLongPress, createMenuTrigger } from "../../utils/gestures";
import { KeyedFor } from "../../utils/keyed";
import { createRipple } from "../../utils/ripple";
import { Avatar } from "../Avatar/Avatar";
import { Badge, CountBadge } from "../Badge/Badge";
import { CustomEmojiGlyph, customEmojiSkeleton } from "../RichText/render";
import { SkeletonCircle, SkeletonText } from "../Skeleton/Skeleton";
import type { VoiceParticipant } from "../Voice/shared";

export type ChannelPlatform = "mobile" | "desktop";

export type ChannelPreviewEmoji = {
	name: string;
	src: string;
	alt?: string;
	pending?: boolean;
};

export type ChannelPreview = {
	author: string;
	text: string;
	parts?: (string | ChannelPreviewEmoji)[];
};

export type ChannelAttachment = "image" | "file";

export type ChannelRowDensity = "default" | "compact";

const compactRowHeight = (platform: ChannelPlatform | undefined) =>
	platform === "desktop" ? "h-10" : "h-11";

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

const PRIVATE_ICON_MASK =
	"radial-gradient(circle at calc(100% - 2px) calc(100% - 2px), transparent 6.5px, #000 7px)";

const ChannelIcon = (props: {
	private?: boolean;
	class?: string;
	children: JSX.Element;
}) => (
	<span
		data-channel-icon=""
		class={cx("relative flex size-4 shrink-0", props.class)}
	>
		<span
			class="flex size-4 [&>svg]:size-4"
			style={
				props.private
					? {
							"mask-image": PRIVATE_ICON_MASK,
							"-webkit-mask-image": PRIVATE_ICON_MASK,
						}
					: undefined
			}
		>
			{props.children}
		</span>
		<Show when={props.private}>
			<span
				role="img"
				aria-label="Private"
				data-channel-private=""
				class="absolute right-[-3px] bottom-[-3px] flex size-2.5 [&>svg]:size-2.5"
			>
				<LockKeyholeMinimalisticIcon />
			</span>
		</Show>
	</span>
);

const RowActionButton = (props: {
	label: string;
	icon: JSX.Element;
	action: "settings" | "chat";
	onClick: () => void;
}) => (
	<button
		type="button"
		aria-label={props.label}
		onClick={(event) => {
			event.preventDefault();
			event.stopPropagation();
			props.onClick();
		}}
		data-channel-settings={props.action === "settings" ? "" : undefined}
		data-channel-chat={props.action === "chat" ? "" : undefined}
		class="relative z-10 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border-0 bg-transparent p-0 text-muted-foreground opacity-0 outline-none group-hover/channel:opacity-100 group-data-[active]/channel:opacity-100 hover:bg-secondary-highlight hover:text-foreground focus-visible:opacity-100 focus-ring [&>svg]:size-4"
	>
		{props.icon}
	</button>
);

const UnreadPill = (props: { class?: string }) => (
	<span
		data-unread-pill=""
		aria-hidden="true"
		class={cx(
			"pointer-events-none absolute -left-2 h-2 w-1 rounded-r-full bg-foreground",
			props.class,
		)}
	/>
);

const showsUnreadPill = (props: {
	unread?: boolean;
	mentions?: number;
	muted?: boolean;
}) => !!props.unread && !props.mentions && !props.muted;

const SettingsButton = (props: { label: string; onClick: () => void }) => (
	<RowActionButton
		label={props.label}
		icon={<SettingsIcon />}
		action="settings"
		onClick={props.onClick}
	/>
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
			<Show when={showsUnreadPill(props)}>
				<UnreadPill class={compact() ? "top-1/2 -translate-y-1/2" : "top-3"} />
			</Show>
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
					compact() && compactRowHeight(props.platform),
					"hover:bg-popover/60",
					rowFocus,
					props.active &&
						(desktop()
							? "bg-popover hover:bg-popover"
							: "bg-muted hover:bg-muted"),
				)}
			>
				<span class="flex h-5 w-full min-w-0 items-center gap-2">
					<ChannelIcon
						private={props.private}
						class={cx(
							lit() ? "text-foreground" : "text-muted-foreground",
							props.muted && "opacity-60",
						)}
					>
						<ChatSquareDotsIcon />
					</ChannelIcon>
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
								{": "}
								<Show when={preview().parts} fallback={preview().text}>
									{(parts) => (
										<For each={parts()}>
											{(part) =>
												typeof part === "string" ? (
													part
												) : part.pending ? (
													customEmojiSkeleton(
														part.name ? `:${part.name}:` : "Custom emoji",
														"size-4 rounded-[6px] bg-clip-content p-0.5 align-[-0.1875rem]",
														{ "data-channel-preview-emoji": "" },
													)
												) : (
													<CustomEmojiGlyph
														data-channel-preview-emoji=""
														emoji={part}
														title={`:${part.name}:`}
														class="size-4 align-[-0.1875rem] object-contain"
													/>
												)
											}
										</For>
									)}
								</Show>
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
				<span
					class={cx("absolute right-1 flex", compact() ? "top-2" : "top-1")}
				>
					<SettingsButton
						label={props.settingsLabel ?? `Settings for ${props.name}`}
						onClick={() => props.onOpenSettings?.()}
					/>
				</span>
			</Show>
		</div>
	);
};

export type ChannelThreadRowProps = Omit<
	RowEvents,
	"onOpenSettings" | "settingsLabel"
> & {
	name: string;
	href?: string;
	active?: boolean;
	unread?: boolean;
	mentions?: number;
	muted?: boolean;
	private?: boolean;
	platform?: ChannelPlatform;
	class?: string;
};

export const ChannelThreadRow = (props: ChannelThreadRowProps) => {
	const ripple = createRipple();
	const mentions = () => props.mentions ?? 0;
	const lit = () =>
		mentions() > 0 || ((!!props.unread || !!props.active) && !props.muted);
	const desktop = () => props.platform === "desktop";

	return (
		<div
			data-channel-thread=""
			data-state={
				mentions() > 0 ? "mentions" : props.unread ? "unread" : "read"
			}
			data-active={props.active || undefined}
			data-muted={props.muted || undefined}
			class={cx("relative flex w-full min-w-0", props.class)}
		>
			<Show when={showsUnreadPill(props)}>
				<UnreadPill class="top-1/2 -translate-y-1/2" />
			</Show>
			<Dynamic
				component={props.href ? "a" : "button"}
				ref={bindGestures(props, ripple)}
				type={props.href ? undefined : "button"}
				href={props.href}
				aria-current={props.active ? "page" : undefined}
				onClick={(event: MouseEvent) => props.onClick?.(event)}
				onContextMenu={(event: MouseEvent) => props.onContextMenu?.(event)}
				class={cx(
					"ripple flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-control-sm border-0 bg-transparent px-2 text-left no-underline select-none [-webkit-touch-callout:none]",
					desktop() ? "h-8" : "h-10",
					"hover:bg-popover/60",
					rowFocus,
					props.active &&
						(desktop()
							? "bg-popover hover:bg-popover"
							: "bg-muted hover:bg-muted"),
				)}
			>
				<ChannelIcon
					private={props.private}
					class={cx(
						lit() ? "text-foreground" : "text-muted-foreground",
						props.muted && "opacity-60",
					)}
				>
					<ThreadIcon />
				</ChannelIcon>
				<span
					data-thread-name=""
					class={cx(
						"min-w-0 flex-1 truncate text-sm leading-5",
						lit()
							? "font-semibold text-foreground"
							: "font-medium text-muted-foreground",
					)}
				>
					{props.name}
				</span>
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
						data-thread-mentions=""
						aria-hidden="true"
						count={mentions()}
						max={9}
					/>
					<span class="sr-only">{`, ${pluralMentions(mentions())}`}</span>
				</Show>
				<Show when={!mentions() && props.unread}>
					<span class="sr-only">, unread</span>
				</Show>
			</Dynamic>
		</div>
	);
};

export type ChannelThreadsProps = {
	children: JSX.Element;
	class?: string;
};

export const ChannelThreads = (props: ChannelThreadsProps) => (
	<div
		data-channel-threads=""
		class={cx(
			"ml-4 flex min-w-0 flex-col gap-0.5 border-0 border-l border-solid border-border pt-0.5 pl-2",
			props.class,
		)}
	>
		{props.children}
	</div>
);

export type VoiceChannelRowProps = RowEvents & {
	name: string;
	onOpenChat?: () => void;
	chatLabel?: string;
	href?: string;
	joined?: boolean;
	active?: boolean;
	muted?: boolean;
	private?: boolean;
	participants?: VoiceParticipant[];
	onOpenParticipant?: (id: string) => void;
	onParticipantMenu?: (id: string) => void;
	canMoveParticipant?: (id: string) => boolean;
	participantMenu?: (
		participant: VoiceParticipant,
		row: JSX.Element,
	) => JSX.Element;
	platform?: ChannelPlatform;
	density?: ChannelRowDensity;
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
	const compact = () => props.density === "compact";
	const actionCount = () =>
		desktop() ? (props.onOpenSettings ? 1 : 0) + (props.onOpenChat ? 1 : 0) : 0;

	return (
		<div
			data-voice-row=""
			data-density={compact() ? "compact" : "default"}
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
					"ripple flex w-full min-w-0 cursor-pointer items-center gap-2 border-0 border-l-2 border-solid bg-transparent p-1.5 text-left no-underline select-none [-webkit-touch-callout:none]",
					compact() ? compactRowHeight(props.platform) : "h-8",
					rowFocus,
					props.joined
						? "rounded-r-control-sm border-primary"
						: "rounded-control-sm border-transparent hover:bg-popover/60",
					props.active &&
						!props.joined &&
						(desktop() ? "bg-popover" : "bg-muted"),
				)}
				style={
					props.joined ? { "background-image": joinedHighlight } : undefined
				}
			>
				<ChannelIcon
					private={props.private}
					class={state() === "empty" ? "text-muted-foreground" : "text-primary"}
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
				</ChannelIcon>
				<span
					data-channel-name=""
					class={cx(
						"min-w-0 flex-1 truncate text-base leading-5 font-semibold",
						props.joined ? "text-foreground" : "text-muted-foreground",
					)}
				>
					{props.name}
				</span>
				<Show when={props.joined}>
					<span class="sr-only">, connected</span>
				</Show>
				<Show when={participants().length > 0}>
					<span class="sr-only">{`, ${participants().length} in voice`}</span>
				</Show>
				<Show when={actionCount() > 0}>
					<span
						aria-hidden="true"
						class={cx("h-5 shrink-0", actionCount() > 1 ? "w-[46px]" : "w-5")}
					/>
				</Show>
			</Dynamic>
			<Show when={actionCount() > 0}>
				<span
					class={cx(
						"absolute right-1 flex h-6 items-center gap-0.5",
						compact() ? "top-2" : "top-1",
					)}
				>
					<Show when={props.onOpenChat}>
						<RowActionButton
							label={props.chatLabel ?? `Open chat for ${props.name}`}
							icon={<ChatRoundDotsIcon />}
							action="chat"
							onClick={() => props.onOpenChat?.()}
						/>
					</Show>
					<Show when={props.onOpenSettings}>
						<SettingsButton
							label={props.settingsLabel ?? `Settings for ${props.name}`}
							onClick={() => props.onOpenSettings?.()}
						/>
					</Show>
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
					<KeyedFor each={participants()} by={(person) => person.id}>
						{(person) => (
							<ParticipantRow
								person={person()}
								live={!!props.joined}
								onOpen={props.onOpenParticipant}
								onMenu={props.onParticipantMenu}
								movable={!!props.canMoveParticipant?.(person().id)}
								wrap={
									props.participantMenu
										? (row) => props.participantMenu?.(person(), row)
										: undefined
								}
							/>
						)}
					</KeyedFor>
				</ul>
			</Show>
		</div>
	);
};

const ParticipantContent = (props: {
	person: VoiceParticipant;
	live: boolean;
}) => (
	<>
		<span
			data-speaking-ring=""
			class={cx(
				"flex shrink-0 rounded-full",
				props.live &&
					props.person.speaking &&
					"outline-[1.5px] outline-offset-1 outline-primary outline-solid",
			)}
		>
			<Avatar
				name={props.person.name}
				seed={props.person.id}
				src={props.person.avatarSrc}
				color={props.person.color}
				size="sm"
				aria-hidden="true"
			/>
		</span>
		<span class="min-w-0 flex-1 truncate text-base leading-5 font-semibold text-muted-foreground">
			{props.person.name}
		</span>
		<Show when={props.live && props.person.speaking}>
			<span class="sr-only">, speaking</span>
		</Show>
		<Show when={props.person.streaming}>
			<span data-voice-streaming="" class="flex shrink-0 items-center">
				<Badge variant="live" aria-hidden="true">
					Live
				</Badge>
				<span class="sr-only">, live</span>
			</span>
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
	</>
);

const wrapRow = (
	wrap: ((row: JSX.Element) => JSX.Element) | undefined,
	row: JSX.Element,
) => (wrap ? untrack(() => wrap(row)) : row);

const ParticipantRow = (props: {
	person: VoiceParticipant;
	live: boolean;
	onOpen?: (id: string) => void;
	onMenu?: (id: string) => void;
	movable?: boolean;
	wrap?: (row: JSX.Element) => JSX.Element;
}) => (
	<li
		ref={(element) =>
			createMenuTrigger(element, {
				enabled: () =>
					!!props.onMenu && !props.person.pending && !props.movable,
				onMenu: () => props.onMenu?.(props.person.id),
			})
		}
		data-voice-participant=""
		data-participant-id={props.person.id}
		data-participant-name={props.person.name}
		data-movable={(props.movable && !props.person.pending) || undefined}
		data-pending={props.person.pending || undefined}
		data-speaking={(props.live && props.person.speaking) || undefined}
		class="flex min-w-0"
	>
		<Show
			when={!props.person.pending}
			fallback={
				<span
					data-voice-participant-skeleton=""
					class="flex min-w-0 flex-1 items-center gap-2 p-1"
				>
					<SkeletonCircle size={24} />
					<SkeletonText size="base" width="45%" />
					<span class="sr-only">Loading participant</span>
				</span>
			}
		>
			{wrapRow(
				props.wrap,
				<Show
					when={props.onOpen}
					fallback={
						<span class="flex min-w-0 flex-1 items-center gap-2 p-1">
							<ParticipantContent person={props.person} live={props.live} />
						</span>
					}
				>
					{(open) => (
						<button
							type="button"
							onClick={() => open()(props.person.id)}
							class={cx(
								"flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-control-xs border-0 bg-transparent p-1 text-left hover:bg-popover/60",
								rowFocus,
							)}
						>
							<ParticipantContent person={props.person} live={props.live} />
						</button>
					)}
				</Show>,
			)}
		</Show>
	</li>
);

export type ChannelListEmptyProps = { children?: JSX.Element };

export const CategoryEmpty = (props: ChannelListEmptyProps) => (
	<span class="px-2 py-1.5 text-xs text-muted-foreground">
		{props.children ?? "This category is empty."}
	</span>
);
