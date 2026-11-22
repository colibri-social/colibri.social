import { ChatRoundLineIcon } from "@solar-icons/solid/bold/chat-round-line";
import { CloseIcon } from "@solar-icons/solid/bold/close";
import { EyeIcon } from "@solar-icons/solid/bold/eye";
import { HeartIcon } from "@solar-icons/solid/bold/heart";
import { RepeatIcon } from "@solar-icons/solid/bold/repeat";
import {
	createSignal,
	For,
	type JSX,
	Match,
	onCleanup,
	onMount,
	Show,
	Switch,
} from "solid-js";
import { cx } from "../../utils/cx";
import { Avatar } from "../Avatar/Avatar";
import { IconButton } from "../IconButton/IconButton";
import {
	EmbedAccentBar,
	embedLinkClass,
	embedRemoveButtonClass,
	linkEmbedFrameClass,
	ProviderIcon,
} from "./LinkEmbed";
import { MediaGrid, type MediaItem } from "./MediaGrid";
import { formatCompact, SpoilerFrame, TextAction } from "./shared";

export type RichTextSpan = {
	text: string;
	bold?: boolean;
	italic?: boolean;
	href?: string;
};

export type RichTextBlock = {
	kind: "paragraph" | "quote";
	spans: RichTextSpan[];
};

export type SocialPostAuthor = {
	name: string;
	handle?: string;
	url?: string;
	avatarSrc?: string;
};

export type SocialPostStats = {
	replies?: number;
	reposts?: number;
	likes?: number;
	views?: number;
};

export type SocialPostQuote = {
	url: string;
	author: SocialPostAuthor;
	body: RichTextBlock[];
	media?: MediaItem[];
	time?: string;
	translatedFrom?: string;
};

export type SocialPostFooter = {
	label: string;
	url?: string;
	iconSrc?: string;
	time?: string;
};

export type SocialPostEmbedProps = {
	url: string;
	author: SocialPostAuthor;
	body: RichTextBlock[];
	accent?: string;
	translatedFrom?: string;
	sensitive?: boolean;
	contentWarning?: string;
	quote?: SocialPostQuote;
	stats?: SocialPostStats;
	media?: MediaItem[];
	footer?: SocialPostFooter;
	onOpenMedia?: (index: number) => void;
	onOpenQuoteMedia?: (index: number) => void;
	onRemove?: (event: MouseEvent) => void;
	removeLabel?: string;
	class?: string;
};

const BODY_LINES = 6;
const QUOTE_LINES = 4;

const languageName = (code: string) => {
	try {
		return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
	} catch {
		return code;
	}
};

const Span = (props: { span: RichTextSpan }) => {
	const styled = (): JSX.Element => (
		<Switch fallback={props.span.text}>
			<Match when={props.span.bold && props.span.italic}>
				<strong>
					<em>{props.span.text}</em>
				</strong>
			</Match>
			<Match when={props.span.bold}>
				<strong>{props.span.text}</strong>
			</Match>
			<Match when={props.span.italic}>
				<em>{props.span.text}</em>
			</Match>
		</Switch>
	);
	return (
		<Show when={props.span.href} fallback={styled()}>
			{(href) => (
				<a
					href={href()}
					target="_blank"
					rel="noreferrer"
					draggable={false}
					class="text-primary-highlight underline-offset-2 outline-none hover:underline focus-ring rounded-control-xs"
				>
					{styled()}
				</a>
			)}
		</Show>
	);
};

const Block = (props: { block: RichTextBlock }) => (
	<Show
		when={props.block.kind === "quote"}
		fallback={
			<p class="m-0">
				<For each={props.block.spans}>{(span) => <Span span={span} />}</For>
			</p>
		}
	>
		<blockquote class="m-0 border-l-4 border-border pl-3 text-muted-foreground">
			<For each={props.block.spans}>{(span) => <Span span={span} />}</For>
		</blockquote>
	</Show>
);

export const RichBody = (props: {
	blocks: RichTextBlock[];
	lines?: number;
	class?: string;
}) => {
	const [expanded, setExpanded] = createSignal(false);
	const [overflows, setOverflows] = createSignal(false);
	let body: HTMLDivElement | undefined;
	const measure = () => {
		if (!body || expanded()) return;
		setOverflows(body.scrollHeight > body.clientHeight + 1);
	};
	onMount(() => {
		measure();
		if (typeof ResizeObserver === "undefined" || !body) return;
		const observer = new ResizeObserver(measure);
		observer.observe(body);
		onCleanup(() => observer.disconnect());
	});
	return (
		<Show when={props.blocks.length > 0}>
			<div class={cx("flex flex-col items-start gap-1", props.class)}>
				<div
					ref={body}
					data-rich-body=""
					class="flex w-full flex-col gap-2 text-sm leading-prose break-words whitespace-pre-wrap select-text"
					style={
						expanded()
							? undefined
							: {
									display: "-webkit-box",
									"-webkit-box-orient": "vertical",
									"-webkit-line-clamp": String(props.lines ?? BODY_LINES),
									overflow: "hidden",
								}
					}
				>
					<For each={props.blocks}>{(block) => <Block block={block} />}</For>
				</div>
				<Show when={overflows() || expanded()}>
					<TextAction
						class="-ml-1 text-xs"
						onClick={() => setExpanded((value) => !value)}
					>
						{expanded() ? "Show less" : "Show more"}
					</TextAction>
				</Show>
			</div>
		</Show>
	);
};

const Translated = (props: { from?: string }) => (
	<Show when={props.from}>
		{(from) => (
			<span class="text-xs text-muted-foreground">
				Translated from {languageName(from())}
			</span>
		)}
	</Show>
);

const AuthorLink = (props: {
	author: SocialPostAuthor;
	href?: string;
	class?: string;
}) => {
	const content = () => (
		<>
			{props.author.handle ? `${props.author.name} ` : props.author.name}
			<Show when={props.author.handle}>
				<span class="font-normal text-muted-foreground">
					(@{props.author.handle})
				</span>
			</Show>
		</>
	);
	return (
		<Show
			when={props.href ?? props.author.url}
			fallback={<span class={cx("truncate", props.class)}>{content()}</span>}
		>
			{(href) => (
				<a
					href={href()}
					target="_blank"
					rel="noreferrer"
					draggable={false}
					class={cx("truncate", embedLinkClass, props.class)}
				>
					{content()}
				</a>
			)}
		</Show>
	);
};

const QuotedPost = (props: {
	quote: SocialPostQuote;
	onOpenMedia?: (index: number) => void;
}) => (
	<div
		data-social-quote=""
		class="flex flex-col gap-1.5 rounded-badge border border-border p-3"
	>
		<span class="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
			<Avatar
				name={props.quote.author.name}
				seed={props.quote.author.handle}
				src={props.quote.author.avatarSrc}
				size="xs"
				class="shrink-0"
			/>
			<AuthorLink author={props.quote.author} href={props.quote.url} />
			<Show when={props.quote.time}>
				<span class="shrink-0 text-xs font-normal text-muted-foreground">
					· {props.quote.time}
				</span>
			</Show>
		</span>
		<RichBody blocks={props.quote.body} lines={QUOTE_LINES} />
		<Translated from={props.quote.translatedFrom} />
		<Show when={props.quote.media?.length}>
			<MediaGrid
				items={props.quote.media ?? []}
				onOpen={props.onOpenMedia}
				maxTiles={4}
				radiusClass="rounded-[2px]"
			/>
		</Show>
	</div>
);

const Stat = (props: { icon: JSX.Element; label: string; value?: number }) => (
	<Show when={props.value !== undefined}>
		<span class="flex items-center gap-1">
			{props.icon}
			<span class="sr-only">{props.label}</span>
			{formatCompact(props.value ?? 0)}
		</span>
	</Show>
);

export const SocialPostEmbed = (props: SocialPostEmbedProps) => {
	const warned = () => !!props.sensitive || !!props.contentWarning;
	const [revealed, setRevealed] = createSignal(false);
	const content = () => (
		<div class="flex flex-col gap-2">
			<RichBody blocks={props.body} />
			<Translated from={props.translatedFrom} />
			<Show when={props.quote}>
				{(quote) => (
					<QuotedPost quote={quote()} onOpenMedia={props.onOpenQuoteMedia} />
				)}
			</Show>
		</div>
	);
	const media = () => (
		<Show when={props.media?.length}>
			<MediaGrid
				items={props.media ?? []}
				onOpen={props.onOpenMedia}
				maxTiles={4}
				radiusClass="rounded-[2px]"
			/>
		</Show>
	);
	return (
		<article
			aria-label={`Post by ${props.author.name}`}
			data-social-embed=""
			class={cx(linkEmbedFrameClass, "group/embed", props.class)}
		>
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
			<span class="flex min-w-0 items-center gap-2 pr-8 text-sm font-semibold">
				<Avatar
					name={props.author.name}
					seed={props.author.handle}
					src={props.author.avatarSrc}
					size="xs"
					class="shrink-0"
				/>
				<AuthorLink author={props.author} />
			</span>
			<Show when={warned()}>
				<span class="text-sm font-semibold text-muted-foreground">
					{props.contentWarning || "Sensitive content"}
				</span>
			</Show>
			<Show
				when={warned()}
				fallback={
					<>
						{content()}
						<Show when={props.stats}>
							{(stats) => <StatsRow stats={stats()} />}
						</Show>
						{media()}
					</>
				}
			>
				<SpoilerFrame
					hidden={!revealed()}
					label="Reveal sensitive post"
					onReveal={() => setRevealed(true)}
					class="flex flex-col gap-2 rounded-[2px]"
				>
					<div class="flex flex-col gap-2">
						{content()}
						{media()}
					</div>
				</SpoilerFrame>
				<Show when={props.stats}>
					{(stats) => <StatsRow stats={stats()} />}
				</Show>
			</Show>
			<Show when={props.footer}>
				{(footer) => (
					<span class="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
						<ProviderIcon src={footer().iconSrc} />
						<Show
							when={footer().url}
							fallback={<span class="truncate">{footer().label}</span>}
						>
							{(href) => (
								<a
									href={href()}
									target="_blank"
									rel="noreferrer"
									draggable={false}
									class={cx("truncate", embedLinkClass)}
								>
									{footer().label}
								</a>
							)}
						</Show>
						<Show when={footer().time}>
							<span aria-hidden="true">•</span>
							<a
								href={props.url}
								target="_blank"
								rel="noreferrer"
								draggable={false}
								class={cx("shrink-0", embedLinkClass)}
							>
								{footer().time}
							</a>
						</Show>
					</span>
				)}
			</Show>
		</article>
	);
};

const StatsRow = (props: { stats: SocialPostStats }) => (
	<div
		data-social-stats=""
		class="flex items-center gap-4 text-xs font-semibold text-muted-foreground tabular-nums [&_svg]:size-4"
	>
		<Stat
			icon={<ChatRoundLineIcon />}
			label="Replies"
			value={props.stats.replies}
		/>
		<Stat icon={<RepeatIcon />} label="Reposts" value={props.stats.reposts} />
		<Stat icon={<HeartIcon />} label="Likes" value={props.stats.likes} />
		<Stat icon={<EyeIcon />} label="Views" value={props.stats.views} />
	</div>
);
