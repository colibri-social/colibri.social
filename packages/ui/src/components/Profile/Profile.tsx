import { PenIcon } from "@solar-icons/solid/bold/pen";
import { children, For, type JSX, Show, splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";
import { cx } from "../../utils/cx";
import { createRipple } from "../../utils/ripple";
import { createSlot } from "../../utils/slot";
import { Avatar, type Presence } from "../Avatar/Avatar";
import { Banner } from "../Banner/Banner";
import { Card, type CardTone } from "../Card/Card";
import { Emoji, EmojiText } from "../Emoji/Emoji";

export type ProfileSurface = "background" | "popover";

const surfaceColor: Record<ProfileSurface, string> = {
	background: "var(--background)",
	popover: "var(--popover)",
};

export type StatusBubbleProps = {
	children?: JSX.Element;
	emoji?: string;
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
					"ripple cursor-pointer outline-none hover:bg-secondary-highlight focus-visible:shadow-[0_0_0_2px_var(--primary)]",
				props.class,
			)}
		>
			<Show when={props.emoji}>
				{(emoji) => (
					<span
						data-status-emoji=""
						class="flex h-[18px] shrink-0 items-center text-sm"
					>
						<Emoji emoji={emoji()} class="mx-0 size-[18px]" />
					</span>
				)}
			</Show>
			<span
				data-status-text=""
				class={cx(
					"line-clamp-3 min-w-0 text-sm leading-[18px] break-words",
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
};

export type ProfileHeaderProps = {
	displayName: string;
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
	statusEditable?: boolean;
	onStatusClick?: JSX.EventHandler<HTMLButtonElement, MouseEvent>;
	actions?: JSX.Element;
	surface?: ProfileSurface;
	headingLevel?: 1 | 2 | 3;
	class?: string;
};

export const ProfileHeader = (props: ProfileHeaderProps) => {
	const badge = createSlot(() => props.badge);
	const appBadge = createSlot(() => props.appBadge);
	const status = createSlot(() => props.status);
	const actions = createSlot(() => props.actions);
	const surface = () => surfaceColor[props.surface ?? "background"];
	const meta = () =>
		[`@${props.handle}`, props.pronouns].filter(
			(part): part is string => !!part,
		);

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
				<span
					class="flex shrink-0 rounded-full p-1"
					style={{ "background-color": surface() }}
				>
					<Avatar
						size="xl"
						name={props.displayName}
						src={props.avatarSrc}
						color={props.avatarColor}
						presence={props.presence}
					/>
				</span>
				<Show when={status.has() || props.statusEmoji}>
					<StatusBubble
						class="mt-[34px]"
						emoji={props.statusEmoji}
						editable={props.statusEditable}
						onClick={props.onStatusClick}
					>
						{status()}
					</StatusBubble>
				</Show>
			</div>
			<div class="flex min-w-0 flex-col gap-1 px-4 pt-2.5">
				<div class="flex min-w-0 items-center gap-2">
					<Dynamic
						component={`h${props.headingLevel ?? 2}`}
						class="m-0 min-w-0 truncate text-2xl leading-[31px] font-bold text-foreground"
						style={props.nameColor ? { color: props.nameColor } : undefined}
					>
						<EmojiText text={props.displayName} />
					</Dynamic>
					<Show when={badge.has()}>{badge()}</Show>
				</div>
				<div class="flex min-h-6 min-w-0 items-center gap-2 text-sm leading-[18px] text-foreground">
					<For each={meta()}>
						{(part, index) => (
							<>
								<Show when={index() > 0}>
									<span
										aria-hidden="true"
										class="size-1 shrink-0 rounded-full bg-muted-foreground"
									/>
								</Show>
								<span class="min-w-0 truncate">{part}</span>
							</>
						)}
					</For>
					<Show when={(props.links ?? []).length > 0}>
						<span
							aria-hidden="true"
							class="size-1 shrink-0 rounded-full bg-muted-foreground"
						/>
						<span class="flex shrink-0 items-center gap-1">
							<For each={props.links}>
								{(link) => (
									<a
										href={link.href}
										target="_blank"
										rel="noreferrer"
										title={link.label}
										aria-label={link.label}
										data-profile-link=""
										class="flex size-6 items-center justify-center rounded-control-xs text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:shadow-[0_0_0_2px_var(--primary)] [&>svg]:size-4 [&>img]:size-4"
									>
										{link.icon}
									</a>
								)}
							</For>
						</span>
					</Show>
					<Show when={appBadge.has()}>
						<span
							aria-hidden="true"
							class="size-1 shrink-0 rounded-full bg-muted-foreground"
						/>
						<span class="flex shrink-0 items-center rounded-control-xs bg-muted p-1 [&>svg]:size-4 [&>img]:size-4">
							{appBadge()}
						</span>
					</Show>
				</div>
			</div>
		</header>
	);
};

export type NowPlayingCardProps = {
	source: string;
	title: string;
	artist?: string;
	album?: string;
	artSrc?: string;
	tone?: CardTone;
	href?: string;
	class?: string;
};

export const NowPlayingCard = (props: NowPlayingCardProps) => {
	const [local] = splitProps(props, [
		"source",
		"title",
		"artist",
		"album",
		"artSrc",
		"tone",
		"href",
		"class",
	]);
	return (
		<Card
			tone={local.tone}
			href={local.href}
			class={cx("flex flex-col gap-2 p-3", local.class)}
		>
			<span class="eyebrow text-foreground">
				Listening to {local.source}
				<span class="sr-only">, </span>
			</span>
			<span class="flex min-w-0 items-center gap-3">
				<span class="relative size-18 shrink-0 overflow-hidden rounded-badge bg-muted">
					<Show when={local.artSrc}>
						<img
							src={local.artSrc}
							alt=""
							draggable={false}
							class="absolute inset-0 size-full object-cover outline-1 -outline-offset-1 outline-white/8"
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
