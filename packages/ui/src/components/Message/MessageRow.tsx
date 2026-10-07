import { RefreshIcon } from "@solar-icons/solid/bold/refresh";
import { TrashBinTrashIcon } from "@solar-icons/solid/bold/trash-bin-trash";
import {
	createEffect,
	createSignal,
	type JSX,
	on,
	onCleanup,
	Show,
	splitProps,
} from "solid-js";
import { cx } from "../../utils/cx";
import { motionScale, prefersReducedMotion } from "../../utils/motion";
import { createSlot } from "../../utils/slot";
import {
	formatFullTimestamp,
	formatMessageTime,
	formatShortTime,
	type TimeInput,
} from "../../utils/time";
import { Avatar } from "../Avatar/Avatar";
import { Drawer, DrawerContent } from "../Drawer/Drawer";
import { DestructiveRow, ListGroup } from "../List/List";
import { chatLayoutVars } from "./layout";

export type MessageAuthor = {
	name: string;
	avatarSrc?: string;
	color?: string;
};

export type MessageReply = {
	author?: MessageAuthor;
	text?: JSX.Element;
	unavailable?: boolean;
	onClick?: () => void;
};

export type MessageHighlight =
	| "mention"
	| "replying"
	| "jumped"
	| "editing"
	| "menu";

export type MessageState = "sent" | "pending" | "failed";

export type MessagePlatform = "desktop" | "mobile";

export type MessageRowProps = Omit<
	JSX.HTMLAttributes<HTMLElement>,
	"children" | "ref"
> & {
	ref?: (element: HTMLElement) => void;
	author: MessageAuthor;
	badge?: JSX.Element;
	via?: string;
	timestamp: TimeInput;
	now?: TimeInput;
	locale?: string;
	continuation?: boolean;
	showTime?: boolean;
	edited?: boolean;
	reply?: MessageReply;
	children?: JSX.Element;
	attachments?: JSX.Element;
	reactions?: JSX.Element;
	thread?: JSX.Element;
	toolbar?: JSX.Element;
	toolbarOpen?: boolean;
	highlight?: MessageHighlight;
	state?: MessageState;
	platform?: MessagePlatform;
	onFailedPress?: () => void;
	onRetry?: () => void;
	onDelete?: () => void;
	onAuthorClick?: (event: MouseEvent) => void;
};

export const PENDING_DIM_DELAY_MS = 300;
export const JUMP_HIGHLIGHT_MS = 1500;
const JUMP_FADE_MS = 600;

const highlightClass: Record<MessageHighlight, string> = {
	mention:
		"bg-primary/10 shadow-[inset_2px_0_0_var(--primary)] hover:bg-primary/15",
	replying: "bg-info/5 shadow-[inset_2px_0_0_var(--info)] hover:bg-info/10",
	jumped: "bg-info/15 shadow-[inset_2px_0_0_var(--info)]",
	editing: "bg-warning/10 shadow-[inset_2px_0_0_var(--warning)]",
	menu: "bg-muted/60 hover:bg-muted/60",
};

const failedLinkButton =
	"cursor-pointer rounded-control-xs text-destructive-highlight underline underline-offset-2 outline-none hover:text-foreground focus-visible:shadow-[0_0_0_2px_var(--primary)]";

const contentText =
	"text-base leading-[21px] [overflow-wrap:anywhere] [&_a]:text-primary-highlight [&_a]:underline-offset-2 [&_a]:decoration-1 [&_a:hover]:underline";

const ReplyLine = (props: { reply: MessageReply }) => {
	const interactive = () => !!props.reply.onClick && !props.reply.unavailable;
	return (
		<div
			data-message-reply=""
			class="relative flex h-4 items-center pl-[calc(40px+var(--chat-avatar-gap,12px))]"
		>
			<span
				aria-hidden="true"
				data-reply-connector=""
				class="pointer-events-none absolute top-[7.5px] left-[19.5px] h-4 w-[calc(16px+var(--chat-avatar-gap,12px))] rounded-tl-[8px] border-t border-l border-secondary group-hover/reply:border-muted-foreground"
			/>
			<Show
				when={!props.reply.unavailable}
				fallback={
					<span class="truncate text-xs leading-4 text-muted-foreground italic">
						This message is no longer available.
					</span>
				}
			>
				<button
					type="button"
					disabled={!interactive()}
					onClick={() => props.reply.onClick?.()}
					class={cx(
						"group/reply flex min-w-0 flex-1 items-center gap-2 text-left text-xs leading-4 text-foreground",
						"outline-none focus-visible:rounded-control-xs focus-visible:shadow-[0_0_0_2px_var(--primary)]",
						interactive() ? "cursor-pointer" : "cursor-default",
					)}
				>
					<Show when={props.reply.author}>
						{(author) => (
							<span class="flex shrink-0 items-center gap-1">
								<span class="relative size-4 shrink-0 overflow-hidden rounded-full bg-accent">
									<Show when={author().avatarSrc}>
										{(src) => (
											<img
												src={src()}
												alt=""
												class="size-full object-cover"
												draggable={false}
											/>
										)}
									</Show>
								</span>
								<span class="font-semibold whitespace-nowrap">
									{author().name}
								</span>
							</span>
						)}
					</Show>
					<span class="min-w-0 flex-1 truncate text-muted-foreground group-hover/reply:text-foreground">
						{props.reply.text}
					</span>
				</button>
			</Show>
		</div>
	);
};

export const MessageRow = (props: MessageRowProps) => {
	const [local, rest] = splitProps(props, [
		"ref",
		"author",
		"badge",
		"via",
		"timestamp",
		"now",
		"locale",
		"continuation",
		"showTime",
		"edited",
		"reply",
		"children",
		"attachments",
		"reactions",
		"thread",
		"toolbar",
		"toolbarOpen",
		"highlight",
		"state",
		"platform",
		"onFailedPress",
		"onRetry",
		"onDelete",
		"onAuthorClick",
		"class",
	]);
	const badge = createSlot(() => local.badge);
	const content = createSlot(() => local.children);
	const attachments = createSlot(() => local.attachments);
	const reactions = createSlot(() => local.reactions);
	const thread = createSlot(() => local.thread);
	const toolbar = createSlot(() => local.toolbar);
	const [dimmed, setDimmed] = createSignal(false);
	const [failedMenuOpen, setFailedMenuOpen] = createSignal(false);
	let root: HTMLElement | undefined;

	createEffect(
		on(
			() => local.state,
			(state) => {
				if (state !== "pending") {
					setDimmed(false);
					return;
				}
				const timer = setTimeout(
					() => setDimmed(true),
					PENDING_DIM_DELAY_MS * motionScale(),
				);
				onCleanup(() => clearTimeout(timer));
			},
		),
	);

	createEffect(
		on(
			() => local.highlight,
			(highlight) => {
				if (highlight !== "jumped" || !root) return;
				const reduced = prefersReducedMotion();
				const fade = root.animate(
					[
						{},
						{
							backgroundColor: "transparent",
							boxShadow: "inset 2px 0 0 transparent",
						},
					],
					{
						duration: reduced ? 0 : JUMP_FADE_MS * motionScale(),
						delay: JUMP_HIGHLIGHT_MS * motionScale(),
						easing: "ease-out",
						fill: "forwards",
					},
				);
				onCleanup(() => fade.cancel());
			},
		),
	);

	const fullTime = () => formatFullTimestamp(local.timestamp, local.locale);
	const isoTime = () => {
		const value = local.timestamp;
		const date = value instanceof Date ? value : new Date(value);
		return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
	};
	const failed = () => local.state === "failed";
	const mobile = () => local.platform === "mobile";
	const openFailedOptions = () => {
		if (local.onFailedPress) {
			local.onFailedPress();
			return;
		}
		setFailedMenuOpen(true);
	};
	const pressFailed = (event: MouseEvent) => {
		if (!failed() || !mobile()) return;
		const target = event.target as Element | null;
		if (target?.closest("a, button, input, textarea, [role='button']")) return;
		openFailedOptions();
	};
	const runFailedAction = (action?: () => void) => {
		setFailedMenuOpen(false);
		action?.();
	};
	const headless = () => !!local.continuation && !local.reply;

	const AuthorAvatar = () => (
		<Avatar
			name={local.author.name}
			src={local.author.avatarSrc}
			color={local.author.color}
			size="md"
		/>
	);

	return (
		<>
			<article
				{...rest}
				ref={(element) => {
					root = element;
					local.ref?.(element);
				}}
				data-message=""
				data-continuation={headless() || undefined}
				data-highlight={local.highlight}
				data-state={local.state ?? "sent"}
				data-dimmed={dimmed() || undefined}
				data-platform={local.platform ?? "desktop"}
				style={{
					...chatLayoutVars(local.platform ?? "desktop"),
					...(typeof rest.style === "object" ? rest.style : {}),
				}}
				onClick={(event) => {
					pressFailed(event);
					if (typeof rest.onClick === "function") rest.onClick(event);
				}}
				class={cx(
					"group/message relative flex flex-col gap-2 pr-(--chat-row-end-padding) pl-(--chat-row-padding)",
					!mobile() && "rounded-r-[4px]",
					headless() ? "py-1" : "mt-(--chat-group-gap) py-1",
					local.highlight
						? highlightClass[local.highlight]
						: failed()
							? "hover:bg-destructive/10"
							: "hover:bg-popover",
					failed() && mobile() && "cursor-pointer",
					local.class,
				)}
			>
				<Show when={local.reply}>
					{(reply) => <ReplyLine reply={reply()} />}
				</Show>
				<div
					class={cx(
						"flex gap-(--chat-avatar-gap) transition-opacity",
						dimmed() && "opacity-60",
					)}
					style={{
						"transition-duration": `calc(150ms * var(--motion-scale, 1))`,
					}}
				>
					<Show
						when={!headless()}
						fallback={
							<span
								data-continuation-time=""
								class={cx(
									"flex h-[21px] w-10 shrink-0 items-center justify-center text-[11px] leading-none whitespace-nowrap text-muted-foreground tabular-nums",
									local.showTime
										? "opacity-100"
										: "opacity-0 group-hover/message:opacity-100 [@media(hover:hover)]:group-focus-within/message:opacity-100",
								)}
							>
								<time datetime={isoTime()} title={fullTime()}>
									{formatShortTime(local.timestamp, local.locale)}
								</time>
							</span>
						}
					>
						<Show when={local.onAuthorClick} fallback={<AuthorAvatar />}>
							{(onClick) => (
								<button
									type="button"
									aria-label={`${local.author.name}'s profile`}
									onClick={(event) => onClick()(event)}
									class="size-10 shrink-0 cursor-pointer self-start rounded-full outline-none focus-visible:shadow-[0_0_0_2px_var(--primary)]"
								>
									<AuthorAvatar />
								</button>
							)}
						</Show>
					</Show>
					<div class="flex min-w-0 flex-1 flex-col gap-1">
						<Show when={!headless()}>
							<div
								data-message-header=""
								class="flex h-4 min-w-0 items-center gap-3"
							>
								<div class="flex min-w-0 items-center gap-1.5">
									<Show
										when={local.onAuthorClick}
										fallback={
											<span
												class={cx(
													"truncate text-sm leading-4 font-semibold",
													failed() ? "text-destructive" : "text-foreground",
												)}
											>
												{local.author.name}
											</span>
										}
									>
										{(onClick) => (
											<button
												type="button"
												onClick={(event) => onClick()(event)}
												class={cx(
													"cursor-pointer truncate rounded-control-xs text-sm leading-4 font-semibold decoration-1 underline-offset-2 outline-none hover:underline focus-visible:shadow-[0_0_0_2px_var(--primary)]",
													failed() ? "text-destructive" : "text-foreground",
												)}
											>
												{local.author.name}
											</button>
										)}
									</Show>
									<Show when={badge.has()}>{badge()}</Show>
									<Show when={local.via}>
										{(via) => (
											<span class="shrink-0 rounded-badge bg-muted px-1 text-xs leading-4 whitespace-nowrap text-muted-foreground">
												via {via()}
											</span>
										)}
									</Show>
								</div>
								<span
									class={cx(
										"flex shrink-0 items-center gap-1.5 text-xs leading-4 whitespace-nowrap",
										failed() ? "text-destructive" : "text-muted-foreground",
									)}
								>
									<time datetime={isoTime()} title={fullTime()}>
										{formatMessageTime(
											local.timestamp,
											local.now,
											local.locale,
										)}
									</time>
									<Show when={local.edited}>
										<span>(edited)</span>
									</Show>
								</span>
							</div>
						</Show>
						<Show when={content.has()}>
							<div
								data-message-content=""
								class={cx(
									contentText,
									failed()
										? "text-destructive [&_a]:text-destructive-highlight [&_a]:underline"
										: "text-foreground",
								)}
							>
								{content()}
								<Show when={headless() && local.edited}>
									<span
										class={cx(
											"ml-1 text-xs",
											failed() ? "text-destructive" : "text-muted-foreground",
										)}
									>
										(edited)
									</span>
								</Show>
							</div>
						</Show>
						<Show when={attachments.has()}>
							<div data-message-attachments="" class="mt-1">
								{attachments()}
							</div>
						</Show>
						<Show when={failed()}>
							<Show
								when={mobile()}
								fallback={
									<p
										data-message-failed=""
										class="flex flex-wrap items-center gap-x-2 text-xs leading-4 text-destructive"
									>
										<span>Failed to send.</span>
										<Show when={local.onRetry}>
											{(onRetry) => (
												<button
													type="button"
													onClick={() => onRetry()()}
													class={failedLinkButton}
												>
													Retry
												</button>
											)}
										</Show>
										<Show when={local.onDelete}>
											{(onDelete) => (
												<button
													type="button"
													onClick={() => onDelete()()}
													class={failedLinkButton}
												>
													Delete
												</button>
											)}
										</Show>
									</p>
								}
							>
								<button
									type="button"
									data-message-failed=""
									aria-haspopup="dialog"
									onClick={openFailedOptions}
									class="flex cursor-pointer items-center self-start rounded-control-xs text-left text-xs leading-4 text-destructive outline-none focus-visible:shadow-[0_0_0_2px_var(--primary)]"
								>
									Failed to send. Tap for options
								</button>
							</Show>
						</Show>
						<Show when={reactions.has()}>
							<div data-message-reactions="" class="mt-1">
								{reactions()}
							</div>
						</Show>
						<Show when={thread.has()}>
							<div data-message-thread="" class="mt-1">
								{thread()}
							</div>
						</Show>
					</div>
				</div>
				<Show when={toolbar.has()}>
					<div
						data-message-toolbar=""
						class={cx(
							"absolute top-0 right-3 z-10 -translate-y-1/2",
							local.toolbarOpen
								? "visible"
								: "invisible group-hover/message:visible [@media(hover:hover)]:group-focus-within/message:visible",
						)}
					>
						{toolbar()}
					</div>
				</Show>
			</article>
			<Show when={failed() && mobile() && !local.onFailedPress}>
				<Drawer open={failedMenuOpen()} onOpenChange={setFailedMenuOpen}>
					<DrawerContent
						title="Failed to send"
						description="This message couldn't be delivered."
					>
						<ListGroup>
							<Show when={local.onRetry}>
								<DestructiveRow
									icon={<RefreshIcon />}
									label="Retry"
									class="text-foreground"
									onClick={() => runFailedAction(local.onRetry)}
								/>
							</Show>
							<Show when={local.onDelete}>
								<DestructiveRow
									icon={<TrashBinTrashIcon />}
									label="Delete message"
									onClick={() => runFailedAction(local.onDelete)}
								/>
							</Show>
						</ListGroup>
					</DrawerContent>
				</Drawer>
			</Show>
		</>
	);
};
