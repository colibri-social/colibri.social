import { Show } from "solid-js";
import { cx } from "../../utils/cx";
import { Skeleton, SkeletonText } from "../Skeleton/Skeleton";
import { createPressRipple, pressSurface } from "./shared";

export type LinkEmbedImage = {
	src: string;
	width?: number;
	height?: number;
};

export type LinkEmbedImageStyle = "large" | "thumbnail";

export type LinkEmbedProps = {
	url: string;
	domain?: string;
	siteName?: string;
	title?: string;
	description?: string;
	image?: LinkEmbedImage;
	imageStyle?: LinkEmbedImageStyle;
	accent?: string;
	onOpenImage?: () => void;
	class?: string;
};

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

const frameClass =
	"relative flex w-full max-w-[416px] flex-col gap-2 overflow-hidden rounded-[6px] border border-border bg-card py-3 pr-3 pl-4 text-foreground";

const AccentBar = (props: { color?: string }) => (
	<span
		aria-hidden="true"
		class="absolute inset-y-0 left-0 w-1"
		style={{ background: props.color ?? "var(--primary)" }}
	/>
);

export const LinkEmbed = (props: LinkEmbedProps) => {
	const press = createPressRipple();
	const style = () => resolveLinkImageStyle(props.image, props.imageStyle);
	const label = () => props.siteName ?? props.domain ?? domainOf(props.url);

	const Image = (imageProps: { image: LinkEmbedImage; class: string }) => (
		<Show
			when={props.onOpenImage}
			fallback={
				<img src={imageProps.image.src} alt="" class={imageProps.class} />
			}
		>
			<button
				type="button"
				data-media-tile=""
				data-index={0}
				aria-label={`Open image from ${label()}`}
				onClick={() => props.onOpenImage?.()}
				class={cx(
					"relative z-10 block shrink-0 cursor-zoom-in overflow-hidden border-0 bg-transparent p-0 outline-none focus-visible:shadow-[0_0_0_2px_var(--primary)]",
					imageProps.class,
				)}
			>
				<img
					src={imageProps.image.src}
					alt=""
					class="block size-full object-cover"
				/>
			</button>
		</Show>
	);

	return (
		<div
			ref={press}
			data-link-embed=""
			class={cx(frameClass, "hover:bg-popover", pressSurface, props.class)}
		>
			<AccentBar color={props.accent} />
			<span class="flex gap-3">
				<a
					href={props.url}
					target="_blank"
					rel="noreferrer"
					class="flex min-w-0 flex-1 flex-col gap-0.5 no-underline outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:rounded-[6px] focus-visible:after:shadow-[inset_0_0_0_2px_var(--primary)]"
				>
					<span class="truncate text-xs text-muted-foreground">{label()}</span>
					<Show when={props.title}>
						<span class="line-clamp-2 text-sm font-semibold text-primary-highlight">
							{props.title}
						</span>
					</Show>
					<Show when={props.description}>
						<span class="line-clamp-2 text-sm text-muted-foreground">
							{props.description}
						</span>
					</Show>
				</a>
				<Show when={style() === "thumbnail" && props.image}>
					{(image) => (
						<Image
							image={image()}
							class="size-18 shrink-0 rounded-[2px] bg-muted object-cover"
						/>
					)}
				</Show>
			</span>
			<Show when={style() === "large" && props.image}>
				{(image) => (
					<Image
						image={image()}
						class="aspect-[1.91] w-full rounded-[2px] bg-muted object-cover"
					/>
				)}
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
		<AccentBar color="var(--muted)" />
		<span class="flex gap-3">
			<span class="flex min-w-0 flex-1 flex-col gap-0.5">
				<SkeletonText size="xs" width="30%" />
				<SkeletonText size="sm" width="75%" />
				<Show when={(props.descriptionLines ?? 2) > 0}>
					<SkeletonText size="sm" lines={props.descriptionLines ?? 2} />
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
