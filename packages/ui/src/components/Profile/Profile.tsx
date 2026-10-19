import { PenIcon } from "@solar-icons/solid/bold/pen";
import { children, For, type JSX, Show, splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";
import { cx } from "../../utils/cx";
import {
	nameColorClass,
	nameColorStyle,
	resolveNameColor,
} from "../../utils/name-color";
import { createRipple } from "../../utils/ripple";
import { createSlot } from "../../utils/slot";
import { isStatusVisible } from "../../utils/status-visibility";
import { AnimatedImage } from "../AnimatedImage/AnimatedImage";
import { Avatar, type Presence } from "../Avatar/Avatar";
import { Banner } from "../Banner/Banner";
import { Card, type CardTone } from "../Card/Card";
import { EmojiText } from "../Emoji/Emoji";
import type { CustomEmoji } from "../EmojiPicker/EmojiPicker";
import { StatusEmoji } from "../StatusField/StatusText";
import { Tooltip, TooltipContent, TooltipTrigger } from "../Tooltip/Tooltip";
import { ActivityIcon } from "./ActivityIcon";

export type ProfileSurface = "background" | "popover";

const surfaceColor: Record<ProfileSurface, string> = {
	background: "var(--background)",
	popover: "var(--popover)",
};

export type StatusBubbleProps = {
	children?: JSX.Element;
	emoji?: string;
	customEmoji?: CustomEmoji;
	editable?: boolean;
	onClick?: JSX.EventHandler<HTMLButtonElement, MouseEvent>;
	actionLabel?: string;
	class?: string;
};

export const StatusBubble = (props: StatusBubbleProps) => {
	const ripple = createRipple();
	const content = children(() => props.children);
	const hasText = () => {
		const value = content();
		return value !== undefined && value !== null && value !== "";
	};
	const interactive = () => !!props.onClick;

	return (
		<Dynamic
			component={interactive() ? "button" : "div"}
			ref={interactive() ? ripple : undefined}
			type={interactive() ? "button" : undefined}
			onClick={props.onClick}
			data-status-bubble=""
			class={cx(
				"flex w-fit max-w-full min-w-0 items-start gap-1.5 rounded-control border border-border bg-secondary px-2 py-1 text-left text-foreground",
				interactive() &&
					"ripple cursor-pointer outline-none hover:bg-secondary-highlight focus-ring",
				props.class,
			)}
		>
			<Show when={props.customEmoji || props.emoji}>
				<span
					data-status-emoji=""
					class="flex h-[18px] shrink-0 items-center text-sm"
				>
					<StatusEmoji
						emoji={props.emoji}
						customEmoji={props.customEmoji}
						size={18}
					/>
				</span>
			</Show>
			<span
				data-status-text=""
				class={cx(
					"line-clamp-3 min-w-0 text-sm leading-[18px] break-words",
					!interactive() && "select-text",
					!hasText() && "sr-only",
				)}
			>
				<Show when={interactive()}>
					<span class="sr-only">{props.actionLabel ?? "Edit status"}: </span>
				</Show>
				{(() => {
					const value = content();
					return typeof value === "string" ? <EmojiText text={value} /> : value;
				})()}
			</span>
			<Show when={props.editable}>
				<span
					aria-hidden="true"
					class="flex size-4 shrink-0 items-center justify-center text-foreground [&>svg]:size-4"
				>
					<PenIcon />
				</span>
			</Show>
		</Dynamic>
	);
};

export type ProfileHeaderLink = {
	label: string;
	href: string;
	icon: JSX.Element;
	tint?: string;
};

const MetaItem = (props: { children: JSX.Element }) => (
	<div
		data-profile-meta-item=""
		class="flex min-h-6 max-w-full min-w-0 items-center"
	>
		<div
			aria-hidden="true"
			data-profile-meta-dot=""
			class="flex w-5 shrink-0 justify-center"
		>
			<div class="size-1 rounded-full bg-muted-foreground" />
		</div>
		{props.children}
	</div>
);

export type ProfileHeaderProps = {
	displayName: string;
	avatarSeed?: string;
	nameColor?: string;
	links?: ProfileHeaderLink[];
	handle: string;
	pronouns?: string;
	avatarSrc?: string;
	avatarColor?: string;
	presence?: Presence;
	bannerSrc?: string;
	bannerColor?: string;
	badge?: JSX.Element;
	appBadge?: JSX.Element;
	status?: JSX.Element;
	statusEmoji?: string;
	statusCustomEmoji?: CustomEmoji;
	statusEditable?: boolean;
	statusShowWhileOffline?: boolean;
	onStatusClick?: JSX.EventHandler<HTMLButtonElement, MouseEvent>;
	onAvatarClick?: JSX.EventHandler<HTMLButtonElement, MouseEvent>;
	avatarLabel?: string;
	avatarPlay?: boolean;
	actions?: JSX.Element;
	surface?: ProfileSurface;
	tight?: boolean;
	headingLevel?: 1 | 2 | 3;
	class?: string;
};

export const ProfileHeader = (props: ProfileHeaderProps) => {
	const badge = createSlot(() => props.badge);
	const appBadge = createSlot(() => props.appBadge);
	const status = createSlot(() => props.status);
	const actions = createSlot(() => props.actions);
	const surface = () => surfaceColor[props.surface ?? "background"];
	const nameColor = () =>
		resolveNameColor({ userColor: props.nameColor, context: "chat" });

	return (
		<header
			class={cx("relative flex w-full flex-col", props.class)}
			style={{ "--avatar-ring": surface() }}
		>
			<Banner
				ratio="user"
				src={props.bannerSrc}
				alt=""
				tintFrom={props.avatarSrc}
				color={props.bannerColor}
			/>
			<Show when={actions.has()}>
				<div class="absolute top-4 right-4 z-10 flex">{actions()}</div>
			</Show>
			<div class="relative -mt-12 flex items-start gap-3 pr-4 pl-3">
				<Dynamic
					component={props.onAvatarClick ? "button" : "span"}
					type={props.onAvatarClick ? "button" : undefined}
					aria-label={props.onAvatarClick ? props.avatarLabel : undefined}
					data-profile-avatar=""
					onClick={props.onAvatarClick}
					class={cx(
						"flex shrink-0 rounded-full border-0 p-1",
						props.onAvatarClick &&
							"cursor-pointer outline-none focus-ring active:scale-[0.97] transition-transform duration-[calc(120ms*var(--motion-scale))]",
					)}
					style={{ "background-color": surface() }}
				>
					<Avatar
						size="xl"
						name={props.displayName}
						seed={props.avatarSeed}
						src={props.avatarSrc}
						color={props.avatarColor}
						presence={props.presence}
						play={props.avatarPlay}
					/>
				</Dynamic>
				<Show
					when={
						(status.has() || props.statusEmoji || props.statusCustomEmoji) &&
						isStatusVisible({
							presence: props.presence,
							showWhileOffline: props.statusShowWhileOffline,
							own: props.statusEditable,
						})
					}
				>
					<StatusBubble
						class="mt-[34px]"
						emoji={props.statusEmoji}
						customEmoji={props.statusCustomEmoji}
						editable={props.statusEditable}
						onClick={props.onStatusClick}
					>
						{status()}
					</StatusBubble>
				</Show>
			</div>
			<div
				data-profile-identity=""
				class={cx(
					"flex min-w-0 flex-col px-4 pt-2.5",
					props.tight ? "gap-[0.5px]" : "gap-1",
				)}
			>
				<div class="flex min-w-0 items-center gap-2">
					<Dynamic
						component={`h${props.headingLevel ?? 2}`}
						data-profile-name=""
						class={cx(
							"m-0 min-w-0 truncate text-2xl leading-[31px] font-bold",
							nameColor() ? nameColorClass : "text-foreground",
						)}
						style={nameColorStyle(nameColor())}
					>
						<EmojiText text={props.displayName} />
					</Dynamic>
					<Show when={badge.has()}>{badge()}</Show>
				</div>
				<div
					data-profile-meta=""
					data-layout-clip=""
					class="-mx-1.5 min-w-0 overflow-x-clip px-1.5 text-sm leading-[18px] text-foreground"
				>
					<div class="-ml-5 flex min-w-0 flex-wrap items-center">
						<MetaItem>
							<span data-profile-handle="" class="min-w-0 truncate select-text">
								{`@${props.handle}`}
							</span>
						</MetaItem>
						<Show when={props.pronouns?.trim()}>
							{(pronouns) => (
								<MetaItem>
									<span
										data-profile-pronouns=""
										class="min-w-0 break-words select-text"
									>
										{pronouns()}
									</span>
								</MetaItem>
							)}
						</Show>
						<Show when={(props.links ?? []).length > 0}>
							<MetaItem>
								<div class="flex min-w-0 flex-wrap items-center gap-1">
									<For each={props.links}>
										{(link) => (
											<Tooltip>
												<TooltipTrigger
													as="a"
													href={link.href}
													target="_blank"
													rel="noreferrer"
													aria-label={link.label}
													data-profile-link=""
													data-tinted={link.tint ? "" : undefined}
													style={
														link.tint
															? { "--profile-link-tint": link.tint }
															: undefined
													}
													class="group/brand-link flex size-6 items-center justify-center rounded-control-xs text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-ring data-tinted:hover:text-(--profile-link-tint) data-tinted:focus-visible:text-(--profile-link-tint) [&>svg]:size-4 [&>img]:size-4"
												>
													{link.icon}
												</TooltipTrigger>
												<TooltipContent>{link.label}</TooltipContent>
											</Tooltip>
										)}
									</For>
								</div>
							</MetaItem>
						</Show>
						<Show when={appBadge.has()}>
							<MetaItem>{appBadge()}</MetaItem>
						</Show>
					</div>
				</div>
			</div>
		</header>
	);
};

export type NowPlayingCardProps = {
	source: string;
	label?: string;
	kind?: string;
	title: string;
	artist?: string;
	album?: string;
	artSrc?: string;
	tone?: CardTone;
	href?: string;
	onOpen?: (event: MouseEvent) => void;
	class?: string;
};

export const NowPlayingCard = (props: NowPlayingCardProps) => {
	const [local] = splitProps(props, [
		"source",
		"label",
		"kind",
		"title",
		"artist",
		"album",
		"artSrc",
		"tone",
		"href",
		"onOpen",
		"class",
	]);
	return (
		<Card
			tone={local.tone}
			href={local.href}
			onClick={local.onOpen}
			data-now-playing={local.kind ?? "listening"}
			class={cx("flex flex-col gap-2 p-3", local.class)}
		>
			<span class="eyebrow text-foreground">
				{local.label ?? `Listening to ${local.source}`}
				<span class="sr-only">, </span>
			</span>
			<span class="flex min-w-0 items-center gap-3">
				<span class="relative flex size-18 shrink-0 items-center justify-center overflow-hidden rounded-badge bg-muted">
					<ActivityIcon
						kind={local.kind}
						class="size-8 text-muted-foreground"
					/>
					<Show when={local.artSrc}>
						<AnimatedImage
							src={local.artSrc}
							alt=""
							draggable={false}
							class="absolute inset-0 size-full object-cover outline-1 -outline-offset-1 outline-white/8 light:outline-black/8"
						/>
					</Show>
				</span>
				<span class="flex min-w-0 flex-1 flex-col gap-1 text-foreground">
					<span class="truncate text-base leading-[21px] font-bold">
						{local.title}
					</span>
					<span class="flex min-w-0 flex-col gap-0.5 text-xs leading-4 font-medium">
						<Show when={local.artist}>
							<span class="truncate">
								<span class="sr-only">, </span>
								{local.artist}
							</span>
						</Show>
						<Show when={local.album}>
							<span class="truncate">
								<span class="sr-only">, </span>
								{local.album}
							</span>
						</Show>
					</span>
				</span>
			</span>
		</Card>
	);
};
