import { RefreshIcon } from "@solar-icons/solid/bold/refresh";
import { StickerSmileCircleIcon } from "@solar-icons/solid/bold/sticker-smile-circle";
import { createEffect, createSignal, For, on, onCleanup, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { embedSurface, formatCompact } from "../Attachments/shared";
import { Avatar } from "../Avatar/Avatar";
import { Button } from "../Button/Button";
import { Drawer, DrawerContent } from "../Drawer/Drawer";
import { Modal, ModalContent } from "../Modal/Modal";
import { AvatarSkeleton, Skeleton, SkeletonText } from "../Skeleton/Skeleton";

export type EmojiPackCardEmoji = { id: string; name: string; src: string };

export type EmojiPackCardOwner = {
	did: string;
	name: string;
	handle: string;
	avatarSrc?: string;
};

export type EmojiPackCardPack = {
	name: string;
	description?: string;
	owner: EmojiPackCardOwner;
	emojis: EmojiPackCardEmoji[];
	total?: number;
};

export type EmojiPackFollowProps = {
	own?: boolean;
	followed?: boolean;
	onFollowChange?: (follow: boolean) => Promise<void> | void;
};

export type EmojiPackCardProps = EmojiPackFollowProps & {
	pack: EmojiPackCardPack;
	url: string;
	platform?: "mobile" | "desktop";
	onNavigate?: (url: string, event: MouseEvent) => void;
	class?: string;
};

const totalOf = (pack: EmojiPackCardPack) =>
	Math.max(pack.total ?? 0, pack.emojis.length);

export const emojiCountLabel = (count: number) =>
	`${formatCompact(count)} emoji`;

const frameMaxWidth = "w-full max-w-[416px]";

export const fitEmojiTiles = (width: number, tile: number, gap: number) =>
	Math.max(1, Math.floor((width + gap) / (tile + gap)));

export const visibleEmojiTiles = (
	capacity: number,
	available: number,
	total: number,
) => {
	const overflow = total > capacity;
	const shown = Math.min(available, overflow ? capacity - 1 : total);
	return { shown, rest: total - shown };
};

type EmojiStripProps = {
	emojis: EmojiPackCardEmoji[];
	total: number;
	tile: number;
	gap: number;
	onOpen: () => void;
	class?: string;
};

const EmojiStrip = (props: EmojiStripProps) => {
	const [width, setWidth] = createSignal(0);
	const columns = () =>
		width() > 0 ? fitEmojiTiles(width(), props.tile, props.gap) : 0;
	const tiles = () =>
		visibleEmojiTiles(
			columns(),
			props.emojis.length,
			columns() === 0 ? 0 : props.total,
		);

	const measure = (element: HTMLElement) => {
		const update = () => setWidth(element.clientWidth);
		update();
		const observer = new ResizeObserver(update);
		observer.observe(element);
		onCleanup(() => observer.disconnect());
	};

	return (
		<button
			type="button"
			data-emoji-strip=""
			data-columns={columns()}
			onClick={() => props.onOpen()}
			class={cx(
				"group/strip block w-full min-w-0 cursor-pointer rounded-control-sm border-0 bg-transparent p-0 text-left outline-none focus-ring",
				props.class,
			)}
		>
			<span class="sr-only">{`View all ${props.total} emoji`}</span>
			<span
				ref={measure}
				class="flex w-full flex-wrap content-start overflow-hidden"
				style={{
					gap: `${props.gap}px`,
					height: `${props.tile}px`,
				}}
			>
				<For each={props.emojis.slice(0, tiles().shown)}>
					{(emoji) => (
						<span
							data-emoji-tile=""
							class="flex shrink-0 items-center justify-center"
							style={{
								width: `${props.tile}px`,
								height: `${props.tile}px`,
							}}
						>
							<img
								src={emoji.src}
								alt=""
								draggable={false}
								class="size-full object-contain"
							/>
						</span>
					)}
				</For>
				<Show when={tiles().rest > 0}>
					<span
						data-emoji-more=""
						class="flex shrink-0 items-center justify-center rounded-control-sm bg-secondary text-xs font-semibold text-secondary-foreground tabular-nums group-hover/strip:bg-secondary-highlight"
						style={{
							width: `${props.tile}px`,
							height: `${props.tile}px`,
						}}
					>
						+{formatCompact(tiles().rest)}
					</span>
				</Show>
			</span>
		</button>
	);
};

type FollowState = {
	pending: () => boolean;
	failed: () => boolean;
	toggle: () => void;
	reset: () => void;
};

const createFollowAction = (props: EmojiPackFollowProps): FollowState => {
	const [pending, setPending] = createSignal(false);
	const [failed, setFailed] = createSignal(false);
	const toggle = async () => {
		const action = props.onFollowChange;
		if (!action || pending()) return;
		setPending(true);
		setFailed(false);
		try {
			await action(!props.followed);
		} catch {
			setFailed(true);
		} finally {
			setPending(false);
		}
	};
	return {
		pending,
		failed,
		toggle: () => void toggle(),
		reset: () => setFailed(false),
	};
};

const FollowButton = (props: {
	state: FollowState;
	followed?: boolean;
	block?: boolean;
	class?: string;
}) => (
	<Button
		block={props.block}
		variant={props.followed ? "secondary" : "primary"}
		loading={props.state.pending()}
		onClick={() => props.state.toggle()}
		class={props.class}
	>
		{props.followed ? "Unfollow pack" : "Follow pack"}
	</Button>
);

const followError = (followed: boolean | undefined) =>
	followed
		? "Couldn't unfollow this pack. Try again."
		: "Couldn't follow this pack. Try again.";

const FollowError = (props: { state: FollowState; followed?: boolean }) => (
	<Show when={props.state.failed()}>
		<p role="alert" class="m-0 text-sm leading-prose text-destructive">
			{followError(props.followed)}
		</p>
	</Show>
);

const OwnBadge = () => (
	<span
		data-own-pack=""
		class="inline-flex h-6 shrink-0 items-center rounded-badge bg-secondary px-2 text-xs font-semibold text-muted-foreground"
	>
		Your pack
	</span>
);

const canFollow = (props: EmojiPackFollowProps) =>
	!props.own && !!props.onFollowChange;

const OwnerLine = (props: { owner: EmojiPackCardOwner; suffix?: string }) => (
	<span class="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
		<Avatar
			name={props.owner.name}
			seed={props.owner.did}
			src={props.owner.avatarSrc}
			size="xs"
			class="shrink-0"
		/>
		<span class="min-w-0 truncate">
			{[`by ${props.owner.name}`, props.suffix].filter(Boolean).join(" · ")}
		</span>
	</span>
);

const PackLink = (props: {
	url: string;
	name: string;
	onNavigate?: (url: string, event: MouseEvent) => void;
	class?: string;
}) => (
	<a
		href={props.url}
		target="_blank"
		rel="noreferrer"
		onClick={(event) => {
			if (!props.onNavigate || event.button !== 0) return;
			event.preventDefault();
			props.onNavigate(props.url, event);
		}}
		class={cx(
			"min-w-0 truncate font-semibold text-foreground no-underline outline-none select-text hover:underline focus-ring",
			props.class,
		)}
	>
		{props.name}
	</a>
);

const FAN = [
	{ rotate: -12, x: -44, y: 6, size: 52 },
	{ rotate: 0, x: 0, y: -2, size: 64 },
	{ rotate: 12, x: 44, y: 6, size: 52 },
];

type BannerCardProps = EmojiPackCardProps & {
	follow: FollowState;
	onOpen: () => void;
};

const BannerCard = (props: BannerCardProps) => {
	const fan = () =>
		props.pack.emojis
			.slice(0, 3)
			.map((emoji, index) => ({ emoji, ...(FAN[index] ?? FAN[1]) }));
	return (
		<article
			aria-label={`Emoji pack ${props.pack.name}`}
			data-emoji-pack-card=""
			class={cx(embedSurface, "flex flex-col", frameMaxWidth, props.class)}
		>
			<div
				aria-hidden="true"
				data-emoji-pack-banner=""
				class="relative h-24 overflow-hidden rounded-t-surface bg-[radial-gradient(120%_140%_at_50%_120%,color-mix(in_srgb,var(--primary)_45%,transparent),transparent_70%)]"
			>
				<For each={fan()}>
					{(item) => (
						<img
							src={item.emoji.src}
							alt=""
							draggable={false}
							class="absolute top-1/2 left-1/2 object-contain drop-shadow-[0_4px_12px_rgb(0_0_0/0.4)]"
							style={{
								width: `${item.size}px`,
								height: `${item.size}px`,
								transform: `translate(calc(-50% + ${item.x}px), calc(-50% + ${item.y}px)) rotate(${item.rotate}deg)`,
							}}
						/>
					)}
				</For>
			</div>
			<div class="flex flex-col gap-3 p-3">
				<span class="flex min-w-0 flex-col gap-1">
					<span class="flex min-w-0 items-center gap-2">
						<PackLink
							url={props.url}
							name={props.pack.name}
							onNavigate={props.onNavigate}
							class="flex-1 text-lg leading-6"
						/>
						<Show when={props.own}>
							<OwnBadge />
						</Show>
					</span>
					<OwnerLine
						owner={props.pack.owner}
						suffix={emojiCountLabel(totalOf(props.pack))}
					/>
					<Show when={props.pack.description}>
						<p class="m-0 line-clamp-2 text-sm leading-prose text-muted-foreground select-text">
							{props.pack.description}
						</p>
					</Show>
				</span>
				<EmojiStrip
					emojis={props.pack.emojis}
					total={totalOf(props.pack)}
					tile={32}
					gap={8}
					onOpen={props.onOpen}
				/>
				<Show when={canFollow(props)}>
					<FollowButton state={props.follow} followed={props.followed} block />
				</Show>
				<FollowError state={props.follow} followed={props.followed} />
			</div>
		</article>
	);
};

export const EmojiPackCard = (props: EmojiPackCardProps) => {
	const [open, setOpen] = createSignal(false);
	const follow = createFollowAction(props);
	return (
		<>
			<BannerCard {...props} follow={follow} onOpen={() => setOpen(true)} />
			<EmojiPackViewAll
				open={open()}
				onOpenChange={setOpen}
				pack={props.pack}
				platform={props.platform}
				own={props.own}
				followed={props.followed}
				onFollowChange={props.onFollowChange}
			/>
		</>
	);
};

export type EmojiPackViewAllProps = EmojiPackFollowProps & {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	pack: EmojiPackCardPack;
	platform?: "mobile" | "desktop";
};

const EmojiGrid = (props: { emojis: EmojiPackCardEmoji[] }) => (
	<ul
		data-emoji-pack-grid=""
		class="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-1 p-0"
	>
		<For each={props.emojis}>
			{(emoji) => (
				<li class="flex min-w-0 flex-col items-center gap-1.5 rounded-control-sm px-1 py-2">
					<img
						src={emoji.src}
						alt=""
						draggable={false}
						class="size-10 object-contain"
					/>
					<span
						title={`:${emoji.name}:`}
						class="w-full min-w-0 truncate text-center text-xs text-muted-foreground select-text"
					>
						:{emoji.name}:
					</span>
				</li>
			)}
		</For>
	</ul>
);

export const EmojiPackViewAll = (props: EmojiPackViewAllProps) => {
	const follow = createFollowAction(props);
	const description = () =>
		`by ${props.pack.owner.name} · ${emojiCountLabel(totalOf(props.pack))}`;
	const footer = () => (
		<div class="flex w-full flex-col gap-2 md:w-auto">
			<FollowError state={follow} followed={props.followed} />
			<FollowButton state={follow} followed={props.followed} block />
		</div>
	);

	createEffect(
		on(
			() => props.open,
			(open) => {
				if (open) follow.reset();
			},
		),
	);

	return (
		<Show
			when={props.platform === "desktop"}
			fallback={
				<Drawer open={props.open} onOpenChange={props.onOpenChange}>
					<DrawerContent
						title={props.pack.name}
						description={description()}
						footer={canFollow(props) ? footer() : undefined}
						aria-label={props.pack.name}
					>
						<div data-emoji-pack-view-all="" data-platform="mobile">
							<EmojiGrid emojis={props.pack.emojis} />
						</div>
					</DrawerContent>
				</Drawer>
			}
		>
			<Modal open={props.open} onOpenChange={props.onOpenChange}>
				<ModalContent
					title={props.pack.name}
					description={description()}
					footer={canFollow(props) ? footer() : undefined}
					class="md:w-[520px]"
				>
					<div
						data-emoji-pack-view-all=""
						data-platform="desktop"
						class="-mx-4 max-h-[min(60dvh,440px)] overflow-y-auto overscroll-contain px-4"
					>
						<EmojiGrid emojis={props.pack.emojis} />
					</div>
				</ModalContent>
			</Modal>
		</Show>
	);
};

export type EmojiPackCardSkeletonProps = {
	class?: string;
};

export const EmojiPackCardSkeleton = (props: EmojiPackCardSkeletonProps) => (
	<div
		aria-hidden="true"
		data-emoji-pack-card-skeleton=""
		class={cx(embedSurface, "flex flex-col", frameMaxWidth, props.class)}
	>
		<Skeleton height={96} class="w-full rounded-t-surface" />
		<div class="flex flex-col gap-3 p-3">
			<span class="flex flex-col gap-1">
				<SkeletonText size="lg" width="55%" />
				<span class="flex items-center gap-1.5">
					<AvatarSkeleton size="xs" />
					<SkeletonText size="xs" width="40%" />
				</span>
			</span>
			<Skeleton height={32} class="w-full rounded-control-sm" />
			<Skeleton height={36} class="w-full rounded-control" />
		</div>
	</div>
);

export type EmojiPackCardUnavailableReason = "missing" | "failed";

export const EMOJI_PACK_UNAVAILABLE_COPY: Record<
	EmojiPackCardUnavailableReason,
	{ title: string; description: string }
> = {
	missing: {
		title: "This emoji pack isn't available",
		description: "Its owner may have deleted it.",
	},
	failed: {
		title: "This emoji pack couldn't load",
		description: "Check your connection and try again.",
	},
};

export type EmojiPackCardUnavailableProps = {
	reason: EmojiPackCardUnavailableReason;
	onRetry?: () => void;
	class?: string;
};

export const EmojiPackCardUnavailable = (
	props: EmojiPackCardUnavailableProps,
) => {
	const copy = () => EMOJI_PACK_UNAVAILABLE_COPY[props.reason];
	return (
		<div
			data-emoji-pack-card-unavailable={props.reason}
			class={cx(
				embedSurface,
				"flex items-center gap-3 p-3 text-foreground",
				frameMaxWidth,
				props.class,
			)}
		>
			<span
				aria-hidden="true"
				class="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground [&>svg]:size-6"
			>
				<StickerSmileCircleIcon />
			</span>
			<span class="flex min-w-0 flex-1 flex-col gap-0.5">
				<span class="text-sm font-semibold">{copy().title}</span>
				<span class="text-sm leading-prose text-muted-foreground">
					{copy().description}
				</span>
			</span>
			<Show when={props.reason === "failed" && props.onRetry}>
				<Button
					variant="secondary"
					icon={<RefreshIcon />}
					onClick={() => props.onRetry?.()}
				>
					Try again
				</Button>
			</Show>
		</div>
	);
};
