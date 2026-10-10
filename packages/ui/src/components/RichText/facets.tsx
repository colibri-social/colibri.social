import { isTimestampStyle, type TimestampStyle } from "@colibri-social/lib";
import { AltArrowRightIcon } from "@solar-icons/solid/bold/alt-arrow-right";
import { CheckIcon } from "@solar-icons/solid/bold/check";
import { CopyIcon } from "@solar-icons/solid/bold/copy";
import { LockKeyholeMinimalisticIcon } from "@solar-icons/solid/bold/lock-keyhole-minimalistic";
import {
	createMemo,
	createResource,
	createSignal,
	type JSX,
	Match,
	onCleanup,
	type ParentProps,
	Show,
	Switch,
} from "solid-js";
import { copyText } from "../../utils/clipboard";
import { cx } from "../../utils/cx";
import { useNow } from "../../utils/now";
import { formatTimestamp } from "../../utils/rich-text/format-timestamp";
import {
	isDisguisedLink,
	isSafeLinkUri,
	literalMarkdownLink,
} from "../../utils/rich-text/link-safety";
import { AnimatedImage } from "../AnimatedImage/AnimatedImage";
import { MentionChip, mentionChipClass, timeChipClass } from "../Badge/Badge";
import type { RichTextResolvers } from "./context";

export const LINK_CLASS =
	"font-medium text-primary-highlight underline-offset-2 decoration-1 outline-none hover:underline focus-visible:underline focus-ring rounded-[2px]";

const CHIP_CLASS =
	"rounded-[2px] px-0.5 no-underline [box-decoration-break:clone] [-webkit-box-decoration-break:clone] outline-none focus-ring";

const CHANNEL_CLASS = cx(
	mentionChipClass("user", true),
	"font-medium outline-none focus-ring",
);

const LOCKED_CLASS = cx(
	CHIP_CLASS,
	"cursor-pointer bg-[color-mix(in_srgb,var(--muted-foreground)_15%,transparent)] text-muted-foreground",
	"hover:bg-[color-mix(in_srgb,var(--muted-foreground)_25%,transparent)]",
);

const CHIP_GLYPH_CLASS =
	"mx-px inline-block size-[0.85em] -translate-y-px align-middle";

export const Spoiler = (props: ParentProps) => {
	const [revealed, setRevealed] = createSignal(false);
	const reveal = () => setRevealed(true);

	return (
		<Show
			when={revealed()}
			fallback={
				// biome-ignore lint/a11y/useSemanticElements: spoilers can wrap links, which a button element may not contain
				<span
					data-facet-type="spoiler"
					data-revealed="false"
					role="button"
					tabIndex={0}
					aria-label="Spoiler, press to reveal"
					class="cursor-pointer rounded-[2px] bg-muted text-transparent outline-none select-none [box-decoration-break:clone] [-webkit-box-decoration-break:clone] hover:bg-secondary-highlight focus-ring [&_*]:bg-transparent! [&_*]:text-transparent! [&_*]:decoration-transparent!"
					onClick={(event) => {
						event.preventDefault();
						event.stopPropagation();
						reveal();
					}}
					onKeyDown={(event) => {
						if (event.key !== "Enter" && event.key !== " ") return;
						event.preventDefault();
						reveal();
					}}
				>
					<span inert aria-hidden="true">
						{props.children}
					</span>
				</span>
			}
		>
			<span
				data-facet-type="spoiler"
				data-revealed="true"
				class="rounded-[2px] bg-[color-mix(in_srgb,var(--muted-foreground)_15%,transparent)] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]"
			>
				{props.children}
			</span>
		</Show>
	);
};

const LiveTimestamp = (props: { datetime: string; style: TimestampStyle }) => {
	const now = useNow();
	const label = createMemo(() =>
		formatTimestamp(props.datetime, props.style, new Date(now())),
	);
	return <>{label()}</>;
};

export const Timestamp = (props: {
	datetime: string;
	style?: unknown;
	fallback: string;
}) => {
	const valid = () => !Number.isNaN(new Date(props.datetime).getTime());
	const style = (): TimestampStyle =>
		isTimestampStyle(props.style) ? props.style : "relative";

	return (
		<Show when={valid()} fallback={props.fallback}>
			<time
				data-facet-type="time"
				dateTime={props.datetime}
				title={formatTimestamp(props.datetime, "datetime-long")}
				class={timeChipClass}
			>
				<Show
					when={style() === "relative"}
					fallback={formatTimestamp(props.datetime, style())}
				>
					<LiveTimestamp datetime={props.datetime} style={style()} />
				</Show>
			</time>
		</Show>
	);
};

const COPIED_MS = 1500;

export const CodeBlock = (props: {
	lang?: string;
	code: string;
	highlight?: RichTextResolvers["highlight"];
}) => {
	const [copied, setCopied] = createSignal(false);
	let timer: ReturnType<typeof setTimeout> | undefined;
	onCleanup(() => clearTimeout(timer));

	const [highlighted] = createResource(
		() => (props.highlight ? { lang: props.lang, code: props.code } : false),
		async ({ lang, code }) => {
			try {
				return (await props.highlight?.(lang, code)) ?? null;
			} catch {
				return null;
			}
		},
	);

	const copy = async () => {
		const ok = await copyText(props.code);
		if (!ok) return;
		setCopied(true);
		clearTimeout(timer);
		timer = setTimeout(() => setCopied(false), COPIED_MS);
	};

	return (
		<div
			data-facet-type="codeblock"
			class="group/codeblock relative my-1 rounded-control-sm border border-border bg-card"
		>
			<Show when={props.lang}>
				<div class="px-3 pt-2 font-mono text-xs leading-4 text-muted-foreground">
					{props.lang}
				</div>
			</Show>
			<button
				type="button"
				data-codeblock-copy=""
				aria-label={copied() ? "Copied" : "Copy code"}
				onClick={copy}
				class={cx(
					"absolute top-1.5 right-1.5 inline-flex size-7 cursor-pointer items-center justify-center rounded-control-sm border border-border bg-secondary text-foreground outline-none",
					"opacity-0 group-hover/codeblock:opacity-100 focus-visible:opacity-100 focus-ring hover:bg-secondary-highlight [@media(hover:none)]:opacity-100",
					copied() && "opacity-100",
				)}
			>
				<Show when={copied()} fallback={<CopyIcon class="size-4" />}>
					<CheckIcon class="size-4" />
				</Show>
			</button>
			<pre
				class={cx(
					"m-0 overflow-x-auto px-3 pr-11 pb-2 font-mono text-sm leading-5 whitespace-pre-wrap [overflow-wrap:anywhere]",
					props.lang ? "pt-1" : "pt-2",
				)}
			>
				<Show
					when={highlighted()}
					fallback={<code class="font-mono">{props.code}</code>}
				>
					{(html) => <code class="font-mono" innerHTML={html()} />}
				</Show>
			</pre>
		</div>
	);
};

const spaceInitials = (name: string) =>
	name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((word) => Array.from(word)[0] ?? "")
		.join("")
		.toUpperCase();

export const ChannelChip = (props: {
	channel: string;
	text: string;
	ctx: RichTextResolvers;
}) => {
	const resolved = createMemo(() => props.ctx.channel?.(props.channel));

	const locked = () => (
		<button
			type="button"
			data-facet-type="channel"
			data-chip=""
			data-locked=""
			data-channel={props.channel}
			class={cx(
				LOCKED_CLASS,
				"inline border-0 font-[inherit] text-[length:inherit] leading-[inherit]",
			)}
			onClick={() => props.ctx.onLockedChannel?.(props.channel)}
		>
			<LockKeyholeMinimalisticIcon
				class={CHIP_GLYPH_CLASS}
				aria-hidden="true"
			/>
			No access
		</button>
	);

	return (
		<Switch fallback={locked()}>
			<Match when={resolved()?.state === "loading"}>
				<span
					data-facet-type="channel"
					data-chip=""
					data-loading=""
					data-channel={props.channel}
					class={cx(CHIP_CLASS, "text-muted-foreground")}
				>
					{props.text}
				</span>
			</Match>
			<Match
				when={(() => {
					const value = resolved();
					return value?.state === "ready" ? value : undefined;
				})()}
			>
				{(ready) => (
					<a
						data-facet-type="channel"
						data-chip=""
						data-channel={props.channel}
						href={ready().href ?? "#"}
						title={ready().space?.name}
						class={CHANNEL_CLASS}
						onClick={(event) => {
							if (!ready().href) event.preventDefault();
							props.ctx.onChannelOpen?.(props.channel, event);
						}}
					>
						<Show when={ready().space}>
							{(space) => (
								<>
									<Show
										when={space().iconSrc}
										fallback={
											<span
												aria-hidden="true"
												class="mx-px inline-flex size-[1.1em] -translate-y-px items-center justify-center rounded-[3px] bg-secondary align-middle text-[0.55em] font-semibold"
											>
												{spaceInitials(space().name)}
											</span>
										}
									>
										{(src) => (
											<AnimatedImage
												src={src()}
												alt=""
												class="mx-px inline-block size-[1.1em] -translate-y-px rounded-[3px] object-cover align-middle"
											/>
										)}
									</Show>
									<AltArrowRightIcon
										class={CHIP_GLYPH_CLASS}
										aria-hidden="true"
									/>
								</>
							)}
						</Show>
						<Show when={ready().category}>
							{(category) => (
								<>
									{category()}
									<AltArrowRightIcon
										class={CHIP_GLYPH_CLASS}
										aria-hidden="true"
									/>
								</>
							)}
						</Show>
						{`#${ready().name}`}
					</a>
				)}
			</Match>
		</Switch>
	);
};

export const LinkFacet = (props: {
	uri: string;
	label: string;
	ctx: RichTextResolvers;
	children: JSX.Element;
}) => {
	const safe = () =>
		isSafeLinkUri(props.uri) && !isDisguisedLink(props.label, props.uri);
	const target = createMemo(() =>
		safe() ? props.ctx.linkTarget?.(props.uri) : undefined,
	);
	const href = () => props.ctx.rewriteUrl?.(props.uri) ?? props.uri;
	const bare = () => props.label.trim() === props.uri;

	return (
		<Switch
			fallback={
				<a
					data-facet-type="link"
					data-uri={props.uri}
					href={href()}
					title={href()}
					target="_blank"
					rel="noreferrer noopener"
					class={LINK_CLASS}
					onClick={(event) => props.ctx.onLinkOpen?.(href(), event)}
				>
					{bare() ? href() : props.children}
				</a>
			}
		>
			<Match when={!safe()}>
				<span data-facet-type="unsafe-link">
					{literalMarkdownLink(props.label, props.uri)}
				</span>
			</Match>
			<Match
				when={(() => {
					const value = target();
					return value?.kind === "channel" ? value : undefined;
				})()}
			>
				{(channel) => (
					<ChannelChip
						channel={channel().channel}
						text={props.label}
						ctx={props.ctx}
					/>
				)}
			</Match>
			<Match
				when={(() => {
					const value = target();
					return value?.kind === "internal" ? value : undefined;
				})()}
			>
				{(internal) => (
					<a
						data-facet-type="link"
						data-uri={props.uri}
						href={internal().href}
						class={LINK_CLASS}
						onClick={(event) => props.ctx.onNavigate?.(internal().href, event)}
					>
						{props.children}
					</a>
				)}
			</Match>
		</Switch>
	);
};

export const MentionFacet = (props: {
	did: string;
	text: string;
	ctx: RichTextResolvers;
}) => {
	const member = createMemo(() => props.ctx.member?.(props.did), undefined, {
		equals: (a, b) => a?.did === b?.did && a?.name === b?.name,
	});

	return (
		<Show
			when={member()}
			keyed
			fallback={
				<MentionChip
					kind="unknown"
					data-facet-type="mention"
					data-chip=""
					data-did={props.did}
				>
					{props.text}
				</MentionChip>
			}
		>
			{(resolved) => {
				const chip = (
					<MentionChip
						kind="user"
						data-facet-type="mention"
						data-chip=""
						data-did={props.did}
					>
						{props.text}
					</MentionChip>
				);
				return props.ctx.wrapMention
					? props.ctx.wrapMention(resolved, chip)
					: chip;
			}}
		</Show>
	);
};

export const RoleFacet = (props: {
	rkey: string;
	text: string;
	ctx: RichTextResolvers;
}) => {
	const role = createMemo(() => props.ctx.role?.(props.rkey), undefined, {
		equals: (a, b) =>
			a?.rkey === b?.rkey && a?.name === b?.name && a?.color === b?.color,
	});

	return (
		<Show
			when={role()}
			keyed
			fallback={
				<MentionChip
					kind="role"
					data-facet-type="role"
					data-chip=""
					data-role={props.rkey}
				>
					@Unknown role
				</MentionChip>
			}
		>
			{(resolved) => {
				const chip = (
					<MentionChip
						kind="role"
						roleColor={resolved.color ?? "currentColor"}
						data-facet-type="role"
						data-chip=""
						data-role={props.rkey}
					>
						{props.text}
					</MentionChip>
				);
				return props.ctx.wrapRole ? props.ctx.wrapRole(resolved, chip) : chip;
			}}
		</Show>
	);
};

export const BridgedMentionFacet = (props: {
	platform: string;
	text: string;
	ctx: RichTextResolvers;
}) => (
	<MentionChip
		kind="bridged"
		platform={props.ctx.bridgePlatformName?.(props.platform) ?? props.platform}
		data-facet-type="bridgedMention"
		data-chip=""
	>
		{props.text}
	</MentionChip>
);
