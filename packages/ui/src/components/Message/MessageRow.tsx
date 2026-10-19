import { RefreshIcon } from "@solar-icons/solid/bold/refresh";
import { TrashBinTrashIcon } from "@solar-icons/solid/bold/trash-bin-trash";
import {
	createEffect,
	createMemo,
	createSignal,
	For,
	type JSX,
	on,
	onCleanup,
	Show,
	splitProps,
} from "solid-js";
import { cx } from "../../utils/cx";
import { createMenuTrigger, useTypingSincePointer } from "../../utils/gestures";
import { useKeyboardModality } from "../../utils/keyboard-modality";
import { motionScale, prefersReducedMotion } from "../../utils/motion";
import {
	nameColorClass,
	nameColorStyle,
	useNameColor,
} from "../../utils/name-color";
import { isStaticSource } from "../../utils/playback";
import { createSlot } from "../../utils/slot";
import {
	formatFullTimestamp,
	formatMessageTime,
	formatShortTime,
	type TimeInput,
} from "../../utils/time";
import { AnimatedImage } from "../AnimatedImage/AnimatedImage";
import { Avatar } from "../Avatar/Avatar";
import { Drawer, DrawerContent } from "../Drawer/Drawer";
import { DestructiveRow, ListGroup } from "../List/List";
import { OwnerBadge } from "../Roles/OwnerBadge";
import { RoleBadge, type RoleIdentity } from "../Roles/RoleBadge";
import { chatLayoutVars } from "./layout";
import { type MessageEditing, MessageEditor } from "./MessageEditor";
import { useMessageListItem } from "./message-list-context";

export type MessageAuthor = {
	name: string;
	seed?: string;
	avatarSrc?: string;
	color?: string;
	nameColor?: string;
	role?: RoleIdentity;
	owner?: boolean;
};

export const useAuthorNameColor = (author: () => MessageAuthor | undefined) =>
	useNameColor(() => ({
		userColor: author()?.nameColor,
		roleColor: author()?.role?.color,
		context: "chat",
	}));

export type MessageReplyEmoji = { name: string; src: string; alt?: string };

export type MessageReply = {
	author?: MessageAuthor;
	text?: JSX.Element;
	parts?: (string | MessageReplyEmoji)[];
	unavailable?: boolean;
	onClick?: () => void;
};

export type MessageHighlight = "mention" | "replying" | "jumped" | "menu";

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
	editing?: MessageEditing;
	state?: MessageState;
	platform?: MessagePlatform;
	onFailedPress?: () => void;
	onRetry?: () => void;
	onDelete?: () => void;
	onAuthorClick?: (event: MouseEvent) => void;
	onAuthorMenu?: (event: Event) => void;
	wrapAuthor?: (trigger: JSX.Element, wrapperClass: string) => JSX.Element;
};

export const JUMP_HIGHLIGHT_MS = 1500;
export const JUMP_FADE_MS = 600;

const TOOLBAR_END_INSET = 12;
const FOCUS_RETURN_MS = 1000;

const supportsTopLayer =
	typeof HTMLElement !== "undefined" && "showPopover" in HTMLElement.prototype;

const clippingAncestors = (element: HTMLElement) => {
	const found: HTMLElement[] = [];
	for (
		let node = element.parentElement;
		node && node !== document.documentElement;
		node = node.parentElement
	) {
		if (getComputedStyle(node).overflowY !== "visible") found.push(node);
	}
	return found;
};

const OVERLAY_SELECTOR =
	'[role="menu"], [role="dialog"], [role="alertdialog"], [role="listbox"], dialog[open]';

const bodyChildOf = (element: HTMLElement) => {
	let node = element;
	while (node.parentElement && node.parentElement !== document.body)
		node = node.parentElement;
	return node;
};

const overlayOutside = (host: HTMLElement) => {
	for (const child of Array.from(document.body.children)) {
		if (child === host) continue;
		if (
			child.matches(OVERLAY_SELECTOR) ||
			child.querySelector(OVERLAY_SELECTOR)
		)
			return true;
	}
	return false;
};

const clipTopOf = (clippers: HTMLElement[]) => {
	let top = Number.NEGATIVE_INFINITY;
	for (const clipper of clippers)
		top = Math.max(top, clipper.getBoundingClientRect().top);
	return top;
};

const highlightClass: Record<MessageHighlight, string> = {
	mention:
		"bg-primary/10 shadow-[inset_2px_0_0_var(--primary)] hover:bg-primary/15",
	replying: "bg-info/5 shadow-[inset_2px_0_0_var(--info)] hover:bg-info/10",
	jumped: "bg-info/15 shadow-[inset_2px_0_0_var(--info)]",
	menu: "bg-muted/60 hover:bg-muted/60",
};

const failedLinkButton =
	"cursor-pointer rounded-control-xs text-destructive-highlight underline underline-offset-2 outline-none hover:text-foreground focus-ring";

const contentText =
	"text-base leading-message select-text [overflow-wrap:anywhere] [&>[data-rich-text]]:inline [&_a:not([data-chip])]:text-primary-highlight [&_a:not([data-chip])]:underline-offset-2 [&_a:not([data-chip])]:decoration-1 [&_a:not([data-chip]):hover]:underline";

const ReplyLine = (props: { reply: MessageReply }) => {
	const interactive = () => !!props.reply.onClick && !props.reply.unavailable;
	const replyNameColor = useAuthorNameColor(() => props.reply.author);
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
						"outline-none focus-visible:rounded-control-xs focus-ring",
						interactive() ? "cursor-pointer" : "cursor-default",
					)}
				>
					<Show when={props.reply.author}>
						{(author) => (
							<span class="flex shrink-0 items-center gap-1">
								<span class="relative size-4 shrink-0 overflow-hidden rounded-full bg-accent">
									<Show when={author().avatarSrc} keyed>
										{(src) => (
											<AnimatedImage
												src={src}
												alt=""
												animated={!isStaticSource(src)}
												playback="demand"
												frameSize={16}
												class="size-full object-cover"
												draggable={false}
											/>
										)}
									</Show>
								</span>
								<span
									data-author-name=""
									class={cx(
										"font-semibold whitespace-nowrap",
										replyNameColor() && nameColorClass,
									)}
									style={nameColorStyle(replyNameColor())}
								>
									{author().name}
								</span>
							</span>
						)}
					</Show>
					<span
						data-reply-text=""
						class="min-w-0 flex-1 truncate text-muted-foreground group-hover/reply:text-foreground"
					>
						<Show when={props.reply.parts} fallback={props.reply.text}>
							{(parts) => (
								<For each={parts()}>
									{(part) =>
										typeof part === "string" ? (
											part
										) : (
											<img
												data-reply-emoji=""
												src={part.src}
												alt={part.alt ?? `:${part.name}:`}
												title={`:${part.name}:`}
												draggable={false}
												class="inline-block size-4 align-[-0.1875rem] object-contain"
											/>
										)
									}
								</For>
							)}
						</Show>
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
		"editing",
		"state",
		"platform",
		"onFailedPress",
		"onRetry",
		"onDelete",
		"onAuthorClick",
		"onAuthorMenu",
		"wrapAuthor",
		"class",
	]);
	const badge = createSlot(() => local.badge);
	const authorInteractive = () => !!(local.onAuthorClick || local.onAuthorMenu);
	const authorMenu = (element: HTMLElement) =>
		createMenuTrigger(element, {
			enabled: () => !!local.onAuthorMenu,
			onMenu: (event) => local.onAuthorMenu?.(event),
		});
	const wrapAuthor = (trigger: JSX.Element, wrapperClass: string) =>
		local.wrapAuthor ? local.wrapAuthor(trigger, wrapperClass) : trigger;
	const nameColor = useAuthorNameColor(() => local.author);
	const nameTone = () =>
		failed()
			? "text-destructive"
			: nameColor()
				? nameColorClass
				: "text-foreground";
	const content = createSlot(() => local.children);
	const attachments = createSlot(() => local.attachments);
	const reactions = createSlot(() => local.reactions);
	const thread = createSlot(() => local.thread);
	const [toolbarArmed, setToolbarArmed] = createSignal(false);
	const armToolbar = () => {
		if (!toolbarArmed()) setToolbarArmed(true);
	};
	const toolbarMounted = createMemo(
		() => toolbarArmed() || !!local.toolbarOpen,
	);
	const toolbar = createSlot(() =>
		toolbarMounted() ? local.toolbar : undefined,
	);
	const showToolbar = () =>
		!editing() && (toolbarMounted() ? toolbar.has() : !mobile());
	const typing = useTypingSincePointer();
	const [pointerInside, setPointerInside] = createSignal(false);
	const [pointerOnToolbar, setPointerOnToolbar] = createSignal(false);
	const [focusInside, setFocusInside] = createSignal(false);
	const [returning, setReturning] = createSignal(false);
	const toolbarHeld = () => !!local.toolbarOpen || returning();
	const toolbarActive = () =>
		toolbarHeld() ||
		(!typing() && (pointerInside() || pointerOnToolbar() || focusInside()));
	const [toolbarLayer, setToolbarLayer] = createSignal<HTMLDivElement>();
	const [overlayOpen, setOverlayOpen] = createSignal(false);
	const inTopLayer = () => supportsTopLayer && !local.toolbarOpen;
	const overlayHides = () => overlayOpen() && !toolbarHeld();
	const dimmed = () => local.state === "pending";
	const [failedMenuOpen, setFailedMenuOpen] = createSignal(false);
	const keyboardModality = useKeyboardModality();
	const [keyboardFocus, setKeyboardFocus] = createSignal(false);
	const listItem = useMessageListItem();
	const highlight = (): MessageHighlight | undefined =>
		listItem?.jumped() ? "jumped" : local.highlight;
	let root: HTMLElement | undefined;

	createEffect(
		on(highlight, (value) => {
			if (value !== "jumped" || !root) return;
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
		}),
	);

	createEffect(
		on(
			() => !!local.toolbarOpen,
			(open, wasOpen) => {
				if (open || !wasOpen) return;
				setReturning(true);
				const release = () => queueMicrotask(() => setReturning(false));
				const timer = setTimeout(release, FOCUS_RETURN_MS);
				document.addEventListener("focusin", release, true);
				onCleanup(() => {
					clearTimeout(timer);
					document.removeEventListener("focusin", release, true);
				});
			},
			{ defer: true },
		),
	);

	createEffect(() => {
		const row = root;
		if (!showToolbar() || !toolbarActive() || !row?.isConnected) {
			setOverlayOpen(false);
			return;
		}
		const host = bodyChildOf(row);
		const check = () => setOverlayOpen(overlayOutside(host));
		check();
		const observer = new MutationObserver((records) => {
			if (records.some((record) => !host.contains(record.target))) check();
		});
		observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["open", "role"],
		});
		onCleanup(() => observer.disconnect());
	});

	createEffect(() => {
		const layer = toolbarLayer();
		if (!layer || !showToolbar() || !toolbarActive()) return;
		const row = root;
		if (!row || !layer.isConnected) return;
		const topLayer = inTopLayer();
		const clippers = clippingAncestors(row);
		const placeInTopLayer = () => {
			const rect = row.getBoundingClientRect();
			const clipTop = clipTopOf(clippers);
			const anchor = Math.max(rect.top, Math.min(clipTop, rect.bottom));
			const end =
				document.documentElement.clientWidth - rect.right + TOOLBAR_END_INSET;
			layer.style.top = `max(${anchor + 1}px, calc(var(--overlay-top, 0px) + ${layer.offsetHeight}px))`;
			layer.style.right = `${end}px`;
		};
		const placeInRow = () => {
			const rect = row.getBoundingClientRect();
			const clipTop = clipTopOf(clippers);
			const offset = Math.max(1, clipTop - rect.top + layer.offsetHeight);
			layer.style.top = `${Math.min(offset, rect.height)}px`;
			layer.style.right = "";
		};
		const place = topLayer ? placeInTopLayer : placeInRow;
		if (topLayer && !layer.matches(":popover-open")) layer.showPopover();
		place();
		const observer = new ResizeObserver(place);
		observer.observe(row);
		observer.observe(layer);
		window.addEventListener("scroll", place, { capture: true, passive: true });
		window.addEventListener("resize", place);
		onCleanup(() => {
			observer.disconnect();
			window.removeEventListener("scroll", place, { capture: true });
			window.removeEventListener("resize", place);
			if (layer.isConnected && layer.matches(":popover-open"))
				layer.hidePopover();
		});
	});

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
		if (!failed() || !mobile() || editing()) return;
		const target = event.target as Element | null;
		if (target?.closest("a, button, input, textarea, [role='button']")) return;
		openFailedOptions();
	};
	const runFailedAction = (action?: () => void) => {
		setFailedMenuOpen(false);
		action?.();
	};
	const headless = () => !!local.continuation && !local.reply;
	const editing = () => (mobile() ? undefined : local.editing);

	const AuthorAvatar = () => (
		<Avatar
			name={local.author.name}
			seed={local.author.seed}
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
				data-media-play-host=""
				data-message-key={listItem?.key}
				aria-posinset={listItem?.position()}
				aria-setsize={listItem?.setSize()}
				tabIndex={listItem ? (listItem.active() ? 0 : -1) : rest.tabIndex}
				data-continuation={headless() || undefined}
				data-highlight={highlight()}
				data-editing={editing() ? "" : undefined}
				data-state={local.state ?? "sent"}
				data-dimmed={dimmed() || undefined}
				data-platform={local.platform ?? "desktop"}
				style={{
					...chatLayoutVars(local.platform ?? "desktop"),
					...(typeof rest.style === "object" ? rest.style : {}),
				}}
				data-keyboard-focus={keyboardFocus() || undefined}
				onClick={(event) => {
					pressFailed(event);
					if (typeof rest.onClick === "function") rest.onClick(event);
				}}
				onPointerEnter={(event) => {
					armToolbar();
					setPointerInside(true);
					if (typeof rest.onPointerEnter === "function")
						rest.onPointerEnter(event);
				}}
				onPointerLeave={(event) => {
					setPointerInside(false);
					if (typeof rest.onPointerLeave === "function")
						rest.onPointerLeave(event);
				}}
				onFocusIn={(event) => {
					armToolbar();
					setFocusInside(true);
					setKeyboardFocus(keyboardModality());
					if (typeof rest.onFocusIn === "function") rest.onFocusIn(event);
				}}
				onFocusOut={(event) => {
					const next = event.relatedTarget as Node | null;
					if (!next || !event.currentTarget.contains(next)) {
						setKeyboardFocus(false);
						setFocusInside(false);
					}
					if (typeof rest.onFocusOut === "function") rest.onFocusOut(event);
				}}
				onPointerDown={(event) => {
					setKeyboardFocus(false);
					if (typeof rest.onPointerDown === "function")
						rest.onPointerDown(event);
				}}
				class={cx(
					"group/message relative flex flex-col gap-2 pr-(--chat-row-end-padding) pl-(--chat-row-padding)",
					!mobile() && "rounded-r-[4px]",
					headless() ? "py-1" : "mt-(--chat-group-gap) py-1",
					highlight()
						? highlightClass[highlight() as MessageHighlight]
						: failed()
							? "hover:bg-destructive/10"
							: mobile()
								? "hover:bg-popover"
								: "hover:bg-popover-highlight",
					failed() && mobile() && "cursor-pointer",
					listItem && "focus-ring-inset",
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
									"flex h-(--leading-message) w-10 shrink-0 items-center justify-center text-[11px] leading-none whitespace-nowrap text-muted-foreground tabular-nums",
									local.showTime
										? "opacity-100"
										: "opacity-0 group-hover/message:opacity-100 [@media(hover:hover)]:group-data-keyboard-focus/message:opacity-100",
								)}
							>
								<time datetime={isoTime()} title={fullTime()}>
									{formatShortTime(local.timestamp, local.locale)}
								</time>
							</span>
						}
					>
						<Show when={authorInteractive()} fallback={<AuthorAvatar />}>
							{(_) =>
								wrapAuthor(
									<button
										type="button"
										ref={authorMenu}
										data-member-menu={local.onAuthorMenu ? "" : undefined}
										aria-label={`${local.author.name}'s profile`}
										onClick={(event) => local.onAuthorClick?.(event)}
										class="size-10 shrink-0 cursor-pointer self-start rounded-full outline-none focus-ring"
									>
										<AuthorAvatar />
									</button>,
									"size-10 shrink-0 self-start",
								)
							}
						</Show>
					</Show>
					<div class="flex min-w-0 flex-1 flex-col gap-1">
						<Show when={!headless()}>
							<div
								data-message-header=""
								class="flex h-4 min-w-0 items-center gap-2"
							>
								<div class="flex min-w-0 items-center gap-1.5">
									<Show
										when={authorInteractive()}
										fallback={
											<span
												data-author-name=""
												class={cx(
													"truncate text-sm leading-4 font-semibold",
													nameTone(),
												)}
												style={
													failed() ? undefined : nameColorStyle(nameColor())
												}
											>
												{local.author.name}
											</span>
										}
									>
										{(_) =>
											wrapAuthor(
												<button
													type="button"
													ref={authorMenu}
													data-member-menu={local.onAuthorMenu ? "" : undefined}
													onClick={(event) => local.onAuthorClick?.(event)}
													data-author-name=""
													class={cx(
														"max-w-full cursor-pointer truncate rounded-control-xs text-sm leading-4 font-semibold decoration-1 underline-offset-2 outline-none hover:underline focus-ring",
														nameTone(),
													)}
													style={
														failed() ? undefined : nameColorStyle(nameColor())
													}
												>
													{local.author.name}
												</button>,
												"flex min-w-0",
											)
										}
									</Show>
									<Show when={local.author.role?.badge && local.author.role}>
										{(role) => <RoleBadge role={role()} />}
									</Show>
									<Show when={local.author.owner}>
										<OwnerBadge />
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
									data-message-time=""
									class={cx(
										"flex shrink-0 items-center gap-1.5 text-[11px] leading-4 whitespace-nowrap tabular-nums",
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
						<Show when={editing()}>
							{(state) => (
								<MessageEditor
									editing={state()}
									platform={local.platform ?? "desktop"}
								/>
							)}
						</Show>
						<Show when={content.has() && !editing()}>
							<div
								data-message-content=""
								class={cx(
									contentText,
									failed()
										? "text-destructive [&_a:not([data-chip])]:text-destructive-highlight [&_a:not([data-chip])]:underline"
										: "text-foreground",
								)}
							>
								{content()}
								<Show when={headless() && local.edited}>
									<span
										class={cx(
											"ml-1 text-xs select-none",
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
									class="flex cursor-pointer items-center self-start rounded-control-xs text-left text-xs leading-4 text-destructive outline-none focus-ring"
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
				<Show when={showToolbar()}>
					<div
						ref={setToolbarLayer}
						data-message-toolbar=""
						popover={supportsTopLayer ? "manual" : undefined}
						data-overlay-hidden={overlayHides() || undefined}
						data-toolbar-layer={inTopLayer() ? "top" : "row"}
						onPointerEnter={() => setPointerOnToolbar(true)}
						onPointerLeave={() => setPointerOnToolbar(false)}
						class={cx(
							"m-0 block overflow-visible border-0 bg-transparent p-0 pb-px text-foreground",
							inTopLayer()
								? "inset-auto -translate-y-3/4"
								: "absolute inset-auto top-px right-3 z-10 -translate-y-3/4",
							!toolbarActive() && "hidden",
							overlayHides() && "pointer-events-none opacity-0",
							toolbarHeld()
								? "visible"
								: "invisible group-hover/message:visible hover:visible [@media(hover:hover)]:group-data-keyboard-focus/message:visible",
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
