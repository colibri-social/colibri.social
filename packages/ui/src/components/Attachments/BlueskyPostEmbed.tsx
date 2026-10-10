import { ChatRoundLineIcon } from "@solar-icons/solid/bold/chat-round-line";
import { HeartIcon } from "@solar-icons/solid/bold/heart";
import { RepeatIcon } from "@solar-icons/solid/bold/repeat";
import { ReplyIcon } from "@solar-icons/solid/bold/reply";
import { VerifiedCheckIcon } from "@solar-icons/solid/bold/verified-check";
import { type JSX, Show } from "solid-js";
import { BlueskyLogo } from "../../icons/animated/brand";
import { cx } from "../../utils/cx";
import { Avatar } from "../Avatar/Avatar";
import { AvatarSkeleton, Skeleton, SkeletonText } from "../Skeleton/Skeleton";
import { MediaGrid, type MediaItem } from "./MediaGrid";
import { embedSurface, formatCompact } from "./shared";

export const BLUESKY_BLUE = "#1185fe";

export type BlueskyAuthor = {
	name: string;
	handle: string;
	avatarSrc?: string;
	verified?: boolean;
};

export type BlueskyPostStats = {
	replies: number;
	reposts: number;
	likes: number;
};

export type BlueskyPost = {
	author: BlueskyAuthor;
	time: string;
	text: string;
	url?: string;
	images?: MediaItem[];
	replyTo?: string;
	quote?: BlueskyPost;
	stats?: BlueskyPostStats;
};

const Verified = () => (
	<span
		role="img"
		aria-label="Verified"
		class="inline-flex shrink-0 [&>svg]:size-3.5"
		style={{ color: BLUESKY_BLUE }}
	>
		<VerifiedCheckIcon />
	</span>
);

const PostHeader = (props: { post: BlueskyPost; size: "sm" | "md" }) => (
	<span class="flex min-w-0 items-center gap-2">
		<Avatar
			name={props.post.author.name}
			src={props.post.author.avatarSrc}
			size={props.size === "md" ? "md" : "xs"}
			class="shrink-0"
		/>
		<span
			class={cx(
				"flex min-w-0",
				props.size === "md" ? "flex-col" : "items-baseline gap-1.5",
			)}
		>
			<span class="flex min-w-0 items-center gap-1 text-sm font-semibold">
				<span class="truncate">{props.post.author.name}</span>
				<Show when={props.post.author.verified}>
					<Verified />
				</Show>
			</span>
			<span class="truncate text-xs text-muted-foreground">
				@{props.post.author.handle} · {props.post.time}
			</span>
		</span>
	</span>
);

const QuotedPost = (props: { post: BlueskyPost }) => (
	<div
		data-bluesky-quote=""
		class="flex flex-col gap-1.5 rounded-badge border border-border p-3"
	>
		<PostHeader post={props.post} size="sm" />
		<p class="m-0 line-clamp-3 text-sm select-text">{props.post.text}</p>
	</div>
);

const Stat = (props: { icon: JSX.Element; label: string; value: number }) => (
	<span class="flex items-center gap-1">
		{props.icon}
		<span class="sr-only">{props.label}</span>
		{formatCompact(props.value)}
	</span>
);

export type BlueskyPostEmbedProps = {
	post: BlueskyPost;
	onOpenImage?: (index: number) => void;
	class?: string;
};

export const BlueskyPostEmbed = (props: BlueskyPostEmbedProps) => (
	<article
		aria-label={`Bluesky post by ${props.post.author.name}`}
		data-bluesky-embed=""
		class={cx(
			embedSurface,
			"flex w-full max-w-[416px] flex-col gap-2.5 p-3",
			props.class,
		)}
	>
		<div class="flex items-start justify-between gap-2">
			<PostHeader post={props.post} size="md" />
			<a
				href={props.post.url ?? "https://bsky.app"}
				target="_blank"
				rel="noreferrer"
				aria-label="Open on Bluesky"
				class="pressable focus-ring flex size-8 shrink-0 items-center justify-center rounded-control-sm hover:bg-secondary"
				style={{ color: BLUESKY_BLUE }}
			>
				<BlueskyLogo size={18} />
			</a>
		</div>
		<Show when={props.post.replyTo}>
			<span class="flex items-center gap-1 text-xs text-muted-foreground [&>svg]:size-3.5">
				<ReplyIcon />
				Replying to @{props.post.replyTo}
			</span>
		</Show>
		<p class="m-0 text-sm whitespace-pre-wrap select-text">{props.post.text}</p>
		<Show when={props.post.images?.length}>
			<MediaGrid
				items={props.post.images ?? []}
				onOpen={props.onOpenImage}
				radiusClass="rounded-badge"
			/>
		</Show>
		<Show when={props.post.quote}>
			{(quote) => <QuotedPost post={quote()} />}
		</Show>
		<Show when={props.post.stats}>
			{(stats) => (
				<div class="flex items-center gap-4 text-xs text-muted-foreground tabular-nums [&_svg]:size-4">
					<Stat
						icon={<ChatRoundLineIcon />}
						label="Replies"
						value={stats().replies}
					/>
					<Stat icon={<RepeatIcon />} label="Reposts" value={stats().reposts} />
					<Stat icon={<HeartIcon />} label="Likes" value={stats().likes} />
				</div>
			)}
		</Show>
	</article>
);

export type BlueskyPostEmbedSkeletonProps = {
	lines?: number;
	stats?: boolean;
	class?: string;
};

export const BlueskyPostEmbedSkeleton = (
	props: BlueskyPostEmbedSkeletonProps,
) => (
	<div
		aria-hidden="true"
		class={cx(
			embedSurface,
			"flex w-full max-w-[416px] flex-col gap-2.5 p-3",
			props.class,
		)}
	>
		<div class="flex items-start justify-between gap-2">
			<span class="flex min-w-0 flex-1 items-center gap-2">
				<AvatarSkeleton size="md" />
				<span class="flex min-w-0 flex-1 flex-col">
					<SkeletonText size="sm" width="40%" />
					<SkeletonText size="xs" width="55%" />
				</span>
			</span>
			<Skeleton width={32} height={32} class="shrink-0 rounded-control-sm" />
		</div>
		<SkeletonText size="sm" lines={props.lines ?? 2} />
		<Show when={props.stats ?? true}>
			<span class="flex items-center gap-4">
				<Skeleton width={36} height={16} />
				<Skeleton width={36} height={16} />
				<Skeleton width={36} height={16} />
			</span>
		</Show>
	</div>
);
