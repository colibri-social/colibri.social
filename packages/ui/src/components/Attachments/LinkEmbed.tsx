import { CloseIcon } from "@solar-icons/solid/bold/close";
import { GalleryIcon } from "@solar-icons/solid/bold/gallery";
import { createEffect, createSignal, on, onCleanup, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { AnimatedImage } from "../AnimatedImage/AnimatedImage";
import { Avatar } from "../Avatar/Avatar";
import { IconButton } from "../IconButton/IconButton";
import { Skeleton, SkeletonText } from "../Skeleton/Skeleton";
import { MediaGrid, type MediaItem } from "./MediaGrid";

export type LinkEmbedImage = {
	src: string;
	width?: number;
	height?: number;
};

export type LinkEmbedImageStyle = "large" | "thumbnail";

export type LinkEmbedProvider = {
	name: string;
	url?: string;
	iconSrc?: string;
};

export type LinkEmbedAuthor = {
	name: string;
	url?: string;
	avatarSrc?: string;
};

export type LinkEmbedProps = {
	url: string;
	domain?: string;
	siteName?: string;
	title?: string;
	description?: string;
	image?: LinkEmbedImage;
	imageStyle?: LinkEmbedImageStyle;
	accent?: string;
	provider?: LinkEmbedProvider;
	author?: LinkEmbedAuthor;
	media?: MediaItem[];
	onOpenMedia?: (index: number) => void;
	onOpenImage?: () => void;
	onRemove?: (event: MouseEvent) => void;
	removeLabel?: string;
	class?: string;
};

export const embedRemoveButtonClass =
	"z-10 opacity-0 group-hover/embed:opacity-100 focus-visible:opacity-100 data-pressed:opacity-100 [@media(hover:none)]:opacity-100";

const domainOf = (url: string) => {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return url;
	}
};

export const resolveLinkImageStyle = (
	image: LinkEmbedImage | undefined,
	style: LinkEmbedImageStyle | undefined,
): LinkEmbedImageStyle | undefined => {
	if (!image) return undefined;
	if (style) return style;
	if (image.width && image.height && image.width / image.height < 1.4)
		return "thumbnail";
	return "large";
};

export const linkEmbedFrameClass =
	"relative flex w-full max-w-[416px] flex-col gap-2 overflow-hidden rounded-[6px] border border-border bg-card py-3 pr-3 pl-4 text-foreground";

const frameClass = linkEmbedFrameClass;

export const embedLinkClass =
	"max-w-full self-start rounded-control-xs no-underline decoration-1 underline-offset-2 outline-none select-text [-webkit-user-drag:none] hover:underline focus-ring";

export const EmbedAccentBar = (props: { color?: string }) => (
	<span
		aria-hidden="true"
		class="absolute inset-y-0 left-0 w-1"
		style={{ background: props.color ?? "var(--primary)" }}
	/>
);

export const ProviderIcon = (props: { src?: string }) => (
	<Show when={props.src}>
		{(src) => (
			<img
				src={src()}
				alt=""
				aria-hidden="true"
				draggable={false}
				loading="lazy"
				class="size-4 shrink-0 rounded-[3px] object-contain"
			/>
		)}
	</Show>
);

const EmbedAuthorLine = (props: { author: LinkEmbedAuthor }) => (
	<span class="flex min-w-0 items-center gap-1.5 pt-0.5">
		<Show when={props.author.avatarSrc}>
			<Avatar
				name={props.author.name}
				src={props.author.avatarSrc}
				size="xs"
				class="shrink-0"
			/>
		</Show>
		<Show
			when={props.author.url}
			fallback={
				<span class="truncate text-sm font-semibold">{props.author.name}</span>
			}
		>
			{(href) => (
				<a
					href={href()}
					target="_blank"
					rel="noreferrer"
					draggable={false}
					class={cx("truncate text-sm font-semibold", embedLinkClass)}
				>
					{props.author.name}
				</a>
			)}
		</Show>
	</span>
);

const EMBED_IMAGE_RETRIES = 2;
const EMBED_IMAGE_BACKOFF_MS = 400;

const retriable = (src: string) =>
	!!src && !src.startsWith("data:") && !src.startsWith("blob:");

const embedImageRetrySrc = (src: string, attempt: number) => {
	if (attempt === 0 || !retriable(src)) return src;
	const hash = src.indexOf("#");
	const base = hash === -1 ? src : src.slice(0, hash);
	const fragment = hash === -1 ? "" : src.slice(hash);
	return `${base}${base.includes("?") ? "&" : "?"}colibri-retry=${attempt}${fragment}`;
};

const createEmbedImageRetry = (src: () => string) => {
	const [attempt, setAttempt] = createSignal(0);
	const [broken, setBroken] = createSignal(false);
	let timer: ReturnType<typeof setTimeout> | undefined;
	onCleanup(() => clearTimeout(timer));
	createEffect(
		on(
			src,
			() => {
				clearTimeout(timer);
				setAttempt(0);
				setBroken(false);
			},
			{ defer: true },
		),
	);
	const fail = () => {
		const current = attempt();
		if (!retriable(src()) || current >= EMBED_IMAGE_RETRIES) {
			setBroken(true);
			return;
		}
		clearTimeout(timer);
		timer = setTimeout(
			() => setAttempt(current + 1),
			EMBED_IMAGE_BACKOFF_MS * (current + 1),
		);
	};
	return {
		src: () => embedImageRetrySrc(src(), attempt()),
		broken,
		fail,
	};
};

const EmbedImagePlaceholder = (props: { class: string }) => (
	<span
		data-embed-image-broken=""
		aria-hidden="true"
		class={cx(
			"flex shrink-0 items-center justify-center bg-muted text-muted-foreground [&>svg]:size-6",
			props.class,
		)}
	>
		<GalleryIcon />
	</span>
);

export const LinkEmbed = (props: LinkEmbedProps) => {
	const style = () => resolveLinkImageStyle(image(), props.imageStyle);
	const label = () =>
		props.provider?.name ??
		props.siteName ??
		props.domain ??
		domainOf(props.url);
	const media = () => props.media ?? [];
	const image = () => (media().length > 0 ? undefined : props.image);

	const Image = (imageProps: {
		image: LinkEmbedImage;
		class: string;
		fit: "cover" | "contain";
	}) => {
		const retry = createEmbedImageRetry(() => imageProps.image.src);
		const fitClass = () =>
			imageProps.fit === "contain" ? "object-contain" : "object-cover";
		return (
			<Show
				when={!retry.broken()}
				fallback={<EmbedImagePlaceholder class={imageProps.class} />}
			>
				<Show
					when={props.onOpenImage}
					fallback={
						<span data-image-src={imageProps.image.src} class="contents">
							<AnimatedImage
								src={retry.src()}
								alt=""
								onError={retry.fail}
								class={cx(imageProps.class, fitClass())}
							/>
						</span>
					}
				>
					<button
						type="button"
						data-media-tile=""
						data-index={0}
						data-image-src={imageProps.image.src}
						aria-label={`Open image from ${label()}`}
						onClick={() => props.onOpenImage?.()}
						class={cx(
							"relative z-10 block shrink-0 cursor-zoom-in overflow-hidden border-0 bg-transparent p-0 outline-none focus-ring",
							imageProps.class,
						)}
					>
						<AnimatedImage
							src={retry.src()}
							alt=""
							onError={retry.fail}
							class={cx("block size-full", fitClass())}
						/>
					</button>
				</Show>
			</Show>
		);
	};

	return (
		<div data-link-embed="" class={cx(frameClass, "group/embed", props.class)}>
			<EmbedAccentBar color={props.accent} />
			<Show when={props.onRemove}>
				<IconButton
					variant="secondary"
					size="sm"
					label={props.removeLabel ?? "Remove link preview"}
					icon={<CloseIcon />}
					onClick={(event) => {
						event.stopPropagation();
						props.onRemove?.(event);
					}}
					class={cx("absolute top-1.5 right-1.5", embedRemoveButtonClass)}
				/>
			</Show>
			<span class="flex gap-3">
				<span class="flex min-w-0 flex-1 flex-col gap-0.5 select-text">
					<Show
						when={props.title}
						fallback={
							<span class="flex min-w-0 items-center gap-1.5">
								<ProviderIcon src={props.provider?.iconSrc} />
								<a
									href={props.url}
									target="_blank"
									rel="noreferrer"
									draggable={false}
									class={cx(
										"truncate text-xs text-muted-foreground",
										embedLinkClass,
									)}
								>
									{label()}
								</a>
							</span>
						}
					>
						<span class="flex min-w-0 items-center gap-1.5">
							<ProviderIcon src={props.provider?.iconSrc} />
							<Show
								when={props.provider?.url}
								fallback={
									<span class="truncate text-xs text-muted-foreground">
										{label()}
									</span>
								}
							>
								{(href) => (
									<a
										href={href()}
										target="_blank"
										rel="noreferrer"
										draggable={false}
										class={cx(
											"truncate text-xs text-muted-foreground",
											embedLinkClass,
										)}
									>
										{label()}
									</a>
								)}
							</Show>
						</span>
						<Show when={props.author}>
							{(author) => <EmbedAuthorLine author={author()} />}
						</Show>
						<a
							href={props.url}
							target="_blank"
							rel="noreferrer"
							draggable={false}
							class={cx(
								"line-clamp-2 text-sm font-semibold text-primary-highlight",
								embedLinkClass,
							)}
						>
							{props.title}
						</a>
					</Show>
					<Show when={props.description}>
						<span class="line-clamp-2 text-sm leading-prose text-muted-foreground">
							{props.description}
						</span>
					</Show>
				</span>
				<Show when={style() === "thumbnail" && image()}>
					{(image) => (
						<Image
							image={image()}
							fit="cover"
							class="size-18 shrink-0 rounded-[2px] bg-muted"
						/>
					)}
				</Show>
			</span>
			<Show when={style() === "large" && image()}>
				{(image) => (
					<Image
						image={image()}
						fit="contain"
						class="aspect-[1.91] w-full rounded-[2px] bg-muted"
					/>
				)}
			</Show>
			<Show when={media().length > 0}>
				<MediaGrid
					items={media()}
					onOpen={props.onOpenMedia}
					maxTiles={4}
					radiusClass="rounded-[2px]"
				/>
			</Show>
		</div>
	);
};

export type LinkEmbedSkeletonProps = {
	imageStyle?: LinkEmbedImageStyle;
	descriptionLines?: number;
	class?: string;
};

export const LinkEmbedSkeleton = (props: LinkEmbedSkeletonProps) => (
	<div aria-hidden="true" class={cx(frameClass, props.class)}>
		<EmbedAccentBar color="var(--muted)" />
		<span class="flex gap-3">
			<span class="flex min-w-0 flex-1 flex-col gap-0.5">
				<SkeletonText size="xs" width="30%" />
				<SkeletonText size="sm" width="75%" />
				<Show when={(props.descriptionLines ?? 2) > 0}>
					<SkeletonText size="sm" prose lines={props.descriptionLines ?? 2} />
				</Show>
			</span>
			<Show when={props.imageStyle === "thumbnail"}>
				<Skeleton width={72} height={72} class="shrink-0 rounded-[2px]" />
			</Show>
		</span>
		<Show when={props.imageStyle === "large"}>
			<Skeleton class="aspect-[1.91] w-full rounded-[2px]" />
		</Show>
	</div>
);
