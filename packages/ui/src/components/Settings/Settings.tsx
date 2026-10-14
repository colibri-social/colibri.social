import { ClockCircleIcon } from "@solar-icons/solid/bold/clock-circle";
import { HashtagIcon } from "@solar-icons/solid/bold/hashtag";
import { MenuDotsVerticalIcon } from "@solar-icons/solid/bold/menu-dots-vertical";
import { TransferHorizontalIcon } from "@solar-icons/solid/bold/transfer-horizontal";
import { UserIcon } from "@solar-icons/solid/bold/user";
import { VerifiedCheckIcon } from "@solar-icons/solid/bold/verified-check";
import {
	createSignal,
	For,
	type JSX,
	onCleanup,
	Show,
	splitProps,
} from "solid-js";
import { copyText } from "../../utils/clipboard";
import { cx } from "../../utils/cx";
import { createSlot } from "../../utils/slot";
import { AnimatedImage } from "../AnimatedImage/AnimatedImage";
import { Avatar } from "../Avatar/Avatar";
import { Card } from "../Card/Card";
import { Checkbox } from "../Checkbox/Checkbox";
import {
	DropdownMenu,
	type DropdownMenuEntry,
} from "../DropdownMenu/DropdownMenu";
import { IconButton } from "../IconButton/IconButton";
import { InviteStateBadge } from "../Invite/InviteStateBadge";
import type { InviteState } from "../Invite/invite-links";
import { SpaceIcon } from "../Space/SpaceIcon";
import { Tooltip, TooltipContent, TooltipTrigger } from "../Tooltip/Tooltip";

const COPIED_MS = 1500;

const cardMenuButton =
	"bg-secondary-highlight enabled:hover:bg-accent data-pressed:bg-accent border-transparent";

export type CardInfoRowProps = {
	icon: JSX.Element;
	label: JSX.Element;
	children: JSX.Element;
	class?: string;
};

export const CardInfoRow = (props: CardInfoRowProps) => (
	<div class={cx("flex min-h-6 min-w-0 items-center gap-2", props.class)}>
		<span class="flex size-6 shrink-0 items-center justify-center text-muted-foreground [&>svg]:size-6">
			{props.icon}
		</span>
		<span class="shrink-0 text-base text-muted-foreground">{props.label}</span>
		<span class="flex min-w-0 items-center gap-1 text-base font-semibold text-foreground">
			{props.children}
		</span>
	</div>
);

export type InviteCardProps = {
	code: string;
	copyValue: string;
	expires: JSX.Element;
	creator: { handle: string; avatar?: string; did?: string };
	uses: JSX.Element;
	state?: InviteState;
	onCopy?: (value: string) => void;
	onMenu?: (event: MouseEvent) => void;
	class?: string;
};

export const InviteCard = (props: InviteCardProps) => {
	const [copied, setCopied] = createSignal(false);
	let timer: ReturnType<typeof setTimeout> | undefined;
	onCleanup(() => clearTimeout(timer));

	const active = () => (props.state ?? "active") === "active";

	const copy = async (anchor: HTMLElement) => {
		if (!active()) return;
		if (!(await copyText(props.copyValue, anchor))) return;
		clearTimeout(timer);
		setCopied(true);
		timer = setTimeout(() => setCopied(false), COPIED_MS);
		props.onCopy?.(props.copyValue);
	};

	return (
		<div class={cx("relative w-full", props.class)}>
			<Card
				tone="secondary"
				data-invite-state={props.state ?? "active"}
				onClick={
					active() ? (event) => void copy(event.currentTarget) : undefined
				}
				class="flex flex-col gap-2 p-4"
			>
				<span class="flex h-7 min-w-0 items-center gap-2 pr-9">
					<Show when={active()}>
						<span class="sr-only">Copy invite link </span>
					</Show>
					<span
						class={cx(
							"min-w-0 truncate text-xl leading-none font-bold",
							!active() && "text-muted-foreground",
						)}
					>
						{props.code}
					</span>
					<InviteStateBadge state={props.state ?? "active"} />
					<span
						aria-hidden="true"
						data-copied={copied() || undefined}
						class="ml-auto shrink-0 text-sm font-semibold text-muted-foreground opacity-0 transition-opacity duration-[calc(var(--duration-color)*var(--motion-scale))] data-copied:opacity-100 motion-reduce:transition-none"
					>
						Copied
					</span>
				</span>
				<CardInfoRow
					icon={<ClockCircleIcon />}
					label={props.state === "expired" ? "Expired:" : "Expires in:"}
				>
					{props.expires}
				</CardInfoRow>
				<CardInfoRow icon={<UserIcon />} label="Created by:">
					<Avatar
						size="xs"
						name={props.creator.handle}
						seed={props.creator.did ?? props.creator.handle}
						src={props.creator.avatar}
						class="shrink-0"
					/>
					<span class="min-w-0 truncate text-sm">{props.creator.handle}</span>
				</CardInfoRow>
				<CardInfoRow icon={<HashtagIcon />} label="Uses:">
					{props.uses}
				</CardInfoRow>
			</Card>
			<IconButton
				size="sm"
				label={`More actions for invite ${props.code}`}
				icon={<MenuDotsVerticalIcon />}
				onClick={(event) => props.onMenu?.(event)}
				class={cx("absolute top-[17px] right-[17px]", cardMenuButton)}
			/>
			<span role="status" aria-live="polite" class="sr-only">
				{copied() ? "Invite link copied" : ""}
			</span>
		</div>
	);
};

export type BridgeCardProps = {
	name: JSX.Element;
	verified?: boolean;
	service: string;
	bridgedWith: JSX.Element;
	menuLabel?: string;
	onMenu?: (event: MouseEvent) => void;
	class?: string;
};

export const BridgeCard = (props: BridgeCardProps) => (
	<Card tone="secondary" class={cx("flex flex-col gap-2 p-4", props.class)}>
		<div class="flex flex-col gap-1">
			<div class="flex min-w-0 items-center justify-between gap-2">
				<span class="flex min-w-0 items-center gap-2">
					<span class="min-w-0 truncate text-xl leading-7 font-bold">
						{props.name}
					</span>
					<Show when={props.verified}>
						<VerifiedCheckIcon
							class="size-6 shrink-0 text-primary"
							aria-label="Verified"
							role="img"
						/>
					</Show>
				</span>
				<IconButton
					size="sm"
					label={props.menuLabel ?? "More actions for bridge"}
					icon={<MenuDotsVerticalIcon />}
					onClick={(event) => props.onMenu?.(event)}
					class={cardMenuButton}
				/>
			</div>
			<div class="flex min-w-0 items-center gap-2 text-xs">
				<span class="shrink-0 text-muted-foreground">Service:</span>
				<span class="min-w-0 truncate font-semibold" title={props.service}>
					{props.service}
				</span>
			</div>
		</div>
		<CardInfoRow icon={<TransferHorizontalIcon />} label="Bridged with:">
			<span class="min-w-0 truncate">{props.bridgedWith}</span>
		</CardInfoRow>
	</Card>
);

export type StepListProps = JSX.OlHTMLAttributes<HTMLOListElement>;

export const StepList = (props: StepListProps) => {
	const [local, rest] = splitProps(props, ["class", "children"]);
	return (
		<ol
			{...rest}
			class={cx(
				"m-0 flex list-none flex-col gap-4 p-0 [counter-reset:step]",
				local.class,
			)}
		>
			{local.children}
		</ol>
	);
};

export type StepProps = {
	title: JSX.Element;
	description?: JSX.Element;
	children?: JSX.Element;
	class?: string;
};

export const Step = (props: StepProps) => {
	const children = createSlot(() => props.children);
	return (
		<li
			class={cx("flex items-start gap-2 [counter-increment:step]", props.class)}
		>
			<span
				aria-hidden="true"
				class="flex size-[34px] shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-base font-bold before:content-[counter(step)]"
			/>
			<div class="flex min-w-0 flex-1 flex-col gap-2">
				<span class="flex min-h-8 items-center text-base font-bold">
					{props.title}
				</span>
				<Show when={props.description}>
					<p class="m-0 text-sm text-muted-foreground">{props.description}</p>
				</Show>
				<Show when={children.has()}>{children()}</Show>
			</div>
		</li>
	);
};

export type EmojiRowProps = {
	name: string;
	src: string;
	uploader?: { handle: string; avatar?: string };
	menuLabel?: string;
	onMenu?: (event: MouseEvent) => void;
	selectable?: boolean;
	selected?: boolean;
	onSelectedChange?: (selected: boolean) => void;
	class?: string;
};

export const EmojiRow = (props: EmojiRowProps) => (
	<div
		data-emoji-row={props.name}
		class={cx(
			"flex h-10 w-full items-center gap-2 pl-3",
			props.selectable ? "pr-2" : "pr-3",
			props.class,
		)}
	>
		<AnimatedImage
			src={props.src}
			alt=""
			width={24}
			height={24}
			class="size-6 shrink-0 object-contain"
		/>
		<span class="min-w-0 flex-1 truncate text-sm font-semibold">
			:{props.name}:
		</span>
		<Show when={props.uploader}>
			{(uploader) => (
				<>
					<span
						class="max-w-[40%] truncate text-xs text-muted-foreground"
						title={uploader().handle}
					>
						{uploader().handle}
					</span>
					<Show
						when={uploader().avatar}
						fallback={
							<span
								aria-hidden="true"
								class="size-4 shrink-0 rounded-full bg-accent"
							/>
						}
					>
						{(avatar) => (
							<AnimatedImage
								src={avatar()}
								alt=""
								width={16}
								height={16}
								class="size-4 shrink-0 rounded-full object-cover outline-1 -outline-offset-1 outline-white/8 light:outline-black/8"
							/>
						)}
					</Show>
				</>
			)}
		</Show>
		<Show
			when={props.selectable}
			fallback={
				<Show when={props.onMenu}>
					<IconButton
						size="sm"
						variant="ghost"
						label={props.menuLabel ?? `More actions for :${props.name}:`}
						icon={<MenuDotsVerticalIcon />}
						onClick={(event) => props.onMenu?.(event)}
						class="-mx-1.5 text-muted-foreground"
					/>
				</Show>
			}
		>
			<Checkbox
				aria-label={`Include :${props.name}:`}
				checked={props.selected ?? false}
				onChange={(next) => props.onSelectedChange?.(next)}
			/>
		</Show>
	</div>
);

export type BridgeStatusTone = "active" | "warning" | "error";

export type BridgeSummaryCardProps = {
	name: string;
	platform: string;
	handle: string;
	verified?: boolean;
	icon?: JSX.Element;
	channels: readonly string[];
	maxChannels?: number;
	status: { tone: BridgeStatusTone; label: string };
	mirrorModeration?: boolean;
	menuLabel?: string;
	menuItems?: DropdownMenuEntry[];
	class?: string;
};

const statusDotClass: Record<BridgeStatusTone, string> = {
	active: "bg-success",
	warning: "bg-warning",
	error: "bg-destructive",
};

const BRIDGE_CHANNEL_CHIPS = 3;

export const BridgeSummaryCard = (props: BridgeSummaryCardProps) => {
	const icon = createSlot(() => props.icon);
	const limit = () => props.maxChannels ?? BRIDGE_CHANNEL_CHIPS;
	const shown = () => props.channels.slice(0, limit());
	const hidden = () => props.channels.slice(limit());

	return (
		<Card
			tone="secondary"
			data-bridge-summary={props.name}
			class={cx("flex min-w-0 flex-col gap-4 p-4", props.class)}
		>
			<div class="flex min-w-0 items-start gap-3">
				<span class="flex size-8 shrink-0 items-center justify-center [&>svg]:size-6">
					<Show
						when={icon.has()}
						fallback={
							<SpaceIcon
								name={props.platform}
								size={32}
								class="bg-accent text-foreground"
							/>
						}
					>
						{icon()}
					</Show>
				</span>
				<div class="flex min-w-0 flex-1 flex-col gap-0.5">
					<span class="flex min-w-0 items-center gap-1.5">
						<span
							class="min-w-0 truncate text-base leading-5 font-bold"
							title={props.name}
						>
							{props.name}
						</span>
						<Show when={props.verified}>
							<VerifiedCheckIcon
								class="size-4 shrink-0 text-primary"
								aria-label="Verified"
								role="img"
							/>
						</Show>
					</span>
					<span
						class="min-w-0 truncate text-xs text-muted-foreground"
						title={`${props.platform} bridge by ${props.handle}`}
					>
						{`${props.platform} bridge by ${props.handle}`}
					</span>
				</div>
				<Show when={props.menuItems?.length}>
					<DropdownMenu
						platform="desktop"
						label={props.menuLabel ?? `${props.name} bridge options`}
						items={props.menuItems}
						placement="bottom-end"
						triggerAs={IconButton}
						triggerProps={{
							size: "sm",
							label: props.menuLabel ?? `More actions for ${props.name} bridge`,
							icon: <MenuDotsVerticalIcon />,
							class: cx("-mt-0.5 -mr-0.5", cardMenuButton),
						}}
					/>
				</Show>
			</div>
			<Show
				when={props.channels.length > 0}
				fallback={
					<p class="m-0 text-sm text-muted-foreground">
						No channels linked yet
					</p>
				}
			>
				<ul
					aria-label="Linked channels"
					data-bridge-channels=""
					class="m-0 flex min-w-0 list-none flex-wrap gap-1.5 p-0"
				>
					<For each={shown()}>
						{(channel) => (
							<li class="flex min-w-0 max-w-full">
								<span
									class="flex h-6 min-w-0 items-center gap-1 rounded-full bg-secondary-highlight pr-2.5 pl-1.5 text-xs font-semibold"
									title={channel}
								>
									<HashtagIcon
										aria-hidden="true"
										class="size-3.5 shrink-0 text-muted-foreground"
									/>
									<span class="min-w-0 truncate">{channel}</span>
								</span>
							</li>
						)}
					</For>
					<Show when={hidden().length > 0}>
						<li class="flex shrink-0">
							<Tooltip placement="top">
								<TooltipTrigger
									as="span"
									tabIndex={0}
									data-bridge-channels-more=""
									aria-label={`${hidden().length} more: ${hidden().join(", ")}`}
									class="focus-ring flex h-6 cursor-default items-center rounded-full bg-secondary-highlight px-2.5 text-xs font-semibold text-muted-foreground"
								>
									{`+${hidden().length}`}
								</TooltipTrigger>
								<TooltipContent>{hidden().join(", ")}</TooltipContent>
							</Tooltip>
						</li>
					</Show>
				</ul>
			</Show>
			<div class="mt-auto flex min-w-0 items-center justify-between gap-3 text-xs">
				<span
					data-bridge-status={props.status.tone}
					class="flex min-w-0 items-center gap-1.5 font-semibold"
				>
					<span
						aria-hidden="true"
						class={cx(
							"size-2 shrink-0 rounded-full",
							statusDotClass[props.status.tone],
						)}
					/>
					<span class="min-w-0 truncate">{props.status.label}</span>
				</span>
				<Show when={props.mirrorModeration !== undefined}>
					<span class="shrink-0 text-muted-foreground">
						{`Mirror moderation: ${props.mirrorModeration ? "on" : "off"}`}
					</span>
				</Show>
			</div>
		</Card>
	);
};
