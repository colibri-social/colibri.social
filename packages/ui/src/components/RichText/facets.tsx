import { isTimestampStyle, type TimestampStyle } from "@colibri-social/lib";
import { AltArrowRightIcon } from "@solar-icons/solid/bold/alt-arrow-right";
import { ChatRoundLineIcon } from "@solar-icons/solid/bold/chat-round-line";
import { CheckIcon } from "@solar-icons/solid/bold/check";
import { CopyIcon } from "@solar-icons/solid/bold/copy";
import { LockKeyholeMinimalisticIcon } from "@solar-icons/solid/bold/lock-keyhole-minimalistic";
import { SmileCircleIcon } from "@solar-icons/solid/bold/smile-circle";
import {
	createMemo,
	createResource,
	createSignal,
	type JSX,
	Match,
	onCleanup,
	type ParentProps,
	Show,
	Suspense,
	Switch,
} from "solid-js";
import { ThreadIcon } from "../../icons/custom";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "../Tooltip/Tooltip";
import type { RichTextLinkTarget, RichTextResolvers } from "./context";

type PackLinkTarget = Extract<RichTextLinkTarget, { kind: "pack" }>;

export const PACK_CHIP_FALLBACK_LABEL = "Emoji pack";
export const MESSAGE_CHIP_LABEL = "Message";

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
				<Suspense fallback={<code class="font-mono">{props.code}</code>}>
					<Show
						when={highlighted()}
						fallback={<code class="font-mono">{props.code}</code>}
					>
						{(html) => <code class="font-mono" innerHTML={html()} />}
					</Show>
				</Suspense>
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
	thread?: { thread: string; href: string };
	message?: { rkey: string; href: string };
}) => {
	const resolved = createMemo(() => props.ctx.channel?.(props.channel));
	const facetType = () => {
		if (props.message) return "message";
		return props.thread ? "thread" : "channel";
	};
	const targetHref = () => props.message?.href ?? props.thread?.href;
	const threadName = () => {
		const target = props.thread;
		if (!target) return undefined;
		return props.ctx.threadName?.(props.channel, target.thread) ?? "Thread";
	};

	const locked = () => (
		<button
			type="button"
			data-facet-type={facetType()}
			data-chip=""
			data-locked=""
			data-channel={props.channel}
			data-thread={props.thread?.thread}
			data-message={props.message?.rkey}
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
					data-facet-type={facetType()}
					data-chip=""
					data-loading=""
					data-channel={props.channel}
					data-thread={props.thread?.thread}
					data-message={props.message?.rkey}
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
					<Tooltip disabled={!ready().space?.name}>
						<TooltipTrigger
							as="a"
							data-facet-type={facetType()}
							data-chip=""
							data-channel={props.channel}
							data-thread={props.thread?.thread}
							data-message={props.message?.rkey}
							href={targetHref() ?? ready().href ?? "#"}
							class={CHANNEL_CLASS}
							onClick={(event) => {
								const href = targetHref();
								if (href) {
									props.ctx.onNavigate?.(href, event);
									return;
								}
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
							<Show when={threadName()}>
								{(name) => (
									<>
										<AltArrowRightIcon
											class={CHIP_GLYPH_CLASS}
											aria-hidden="true"
										/>
										<ThreadIcon class={CHIP_GLYPH_CLASS} aria-hidden="true" />
										{name()}
									</>
								)}
							</Show>
							<Show when={props.message}>
								<AltArrowRightIcon
									class={CHIP_GLYPH_CLASS}
									aria-hidden="true"
								/>
								<ChatRoundLineIcon
									class={CHIP_GLYPH_CLASS}
									aria-hidden="true"
								/>
								{MESSAGE_CHIP_LABEL}
							</Show>
						</TooltipTrigger>
						<TooltipContent>{ready().space?.name}</TooltipContent>
					</Tooltip>
				)}
			</Match>
		</Switch>
	);
};

export const PackChip = (props: {
	target: PackLinkTarget;
	ctx: RichTextResolvers;
}) => (
	<a
		data-facet-type="pack"
		data-chip=""
		data-pack={`${props.target.did}/${props.target.rkey}`}
		data-loading={props.target.name ? undefined : ""}
		href={props.target.href}
		draggable={false}
		class={CHANNEL_CLASS}
		onClick={(event) => props.ctx.onNavigate?.(props.target.href, event)}
	>
		<Show
			when={props.target.cover}
			fallback={<SmileCircleIcon class={CHIP_GLYPH_CLASS} aria-hidden="true" />}
		>
			{(cover) => (
				<AnimatedImage
					src={cover().src}
					alt=""
					data-pack-cover=""
					class="mx-px inline-block size-[1.1em] -translate-y-px object-contain align-middle"
				/>
			)}
		</Show>
		{props.target.name || PACK_CHIP_FALLBACK_LABEL}
	</a>
);

export const LinkFacet = (props: {
	uri: string;
	label: string;
	ctx: RichTextResolvers;
	children: JSX.Element;
}) => {
	const disguised = () => isDisguisedLink(props.label, props.uri);
	const safe = () =>
		isSafeLinkUri(props.uri) && (!disguised() || !!props.ctx.onExternalLink);
	const target = createMemo(() =>
		safe() && !disguised() ? props.ctx.linkTarget?.(props.uri) : undefined,
	);
	const href = () => {
		const value = target();
		if (value?.kind === "external") return value.href;
		return props.ctx.rewriteUrl?.(props.uri) ?? props.uri;
	};
	const label = () => {
		const value = target();
		return value?.kind === "external" ? props.uri : href();
	};
	const bare = () => props.label.trim() === props.uri;
	const open = (event: MouseEvent) => {
		const confirm = props.ctx.onExternalLink;
		if (confirm) {
			event.preventDefault();
			confirm(href(), { label: props.label, disguised: disguised() });
			return;
		}
		props.ctx.onLinkOpen?.(href(), event);
	};

	return (
		<Switch
			fallback={
				<Tooltip disabled={bare()}>
					<TooltipTrigger
						as="a"
						data-facet-type="link"
						data-uri={props.uri}
						href={href()}
						target="_blank"
						rel="noreferrer noopener"
						draggable={false}
						data-disguised={disguised() || undefined}
						class={LINK_CLASS}
						onClick={open}
					>
						{bare() ? label() : props.children}
					</TooltipTrigger>
					<TooltipContent class="break-all">{href()}</TooltipContent>
				</Tooltip>
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
					return value?.kind === "thread" ? value : undefined;
				})()}
			>
				{(thread) => (
					<ChannelChip
						channel={thread().channel}
						text={props.label}
						ctx={props.ctx}
						thread={{
							thread: thread().thread,
							href: thread().href ?? props.uri,
						}}
					/>
				)}
			</Match>
			<Match
				when={(() => {
					const value = target();
					return value?.kind === "message" ? value : undefined;
				})()}
			>
				{(message) => (
					<ChannelChip
						channel={message().channel}
						text={props.label}
						ctx={props.ctx}
						thread={(() => {
							const thread = message().thread;
							return thread ? { thread, href: message().href } : undefined;
						})()}
						message={{ rkey: message().rkey, href: message().href }}
					/>
				)}
			</Match>
			<Match
				when={(() => {
					const value = target();
					return value?.kind === "pack" ? value : undefined;
				})()}
			>
				{(pack) => <PackChip target={pack()} ctx={props.ctx} />}
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
						draggable={false}
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
				<Show
					when={!props.ctx.plainUnresolvedMentions}
					fallback={
						<span data-facet-type="mention" data-did={props.did}>
							{props.text}
						</span>
					}
				>
					<MentionChip
						kind="unknown"
						data-facet-type="mention"
						data-chip=""
						data-did={props.did}
					>
						{props.text}
					</MentionChip>
				</Show>
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
	registration?: string;
	remoteId?: string;
	text: string;
	ctx: RichTextResolvers;
}) => {
	const resolves = () =>
		!!props.ctx.bridgedMember && props.remoteId !== undefined;
	const name = createMemo(() =>
		resolves()
			? props.ctx.bridgedMember?.({
					registration: props.registration,
					platform: props.platform,
					remoteId: props.remoteId,
				})?.name
			: props.text,
	);
	const label = () => {
		const value = name();
		if (!value || !resolves()) return value;
		return value.startsWith("@") ? value : `@${value}`;
	};

	return (
		<Show
			when={label()}
			fallback={
				<span data-facet-type="bridgedMention" data-remote-id={props.remoteId}>
					{props.text}
				</span>
			}
		>
			{(text) => (
				<MentionChip
					kind="bridged"
					platform={
						props.ctx.bridgePlatformName?.(props.platform) ?? props.platform
					}
					data-facet-type="bridgedMention"
					data-chip=""
					data-remote-id={props.remoteId}
				>
					{text()}
				</MentionChip>
			)}
		</Show>
	);
};
