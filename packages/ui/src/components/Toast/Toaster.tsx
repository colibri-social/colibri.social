import { CheckCircleIcon } from "@solar-icons/solid/bold/check-circle";
import { CloseIcon } from "@solar-icons/solid/bold/close";
import { DangerCircleIcon } from "@solar-icons/solid/bold/danger-circle";
import { DangerTriangleIcon } from "@solar-icons/solid/bold/danger-triangle";
import { InfoCircleIcon } from "@solar-icons/solid/bold/info-circle";
import {
	type Accessor,
	createEffect,
	createMemo,
	createSignal,
	For,
	Match,
	on,
	onCleanup,
	onMount,
	Show,
	Switch,
} from "solid-js";
import { Portal } from "solid-js/web";
import { cx } from "../../utils/cx";
import { useHaptics } from "../../utils/haptics";
import {
	motionScale,
	playKeyframes,
	prefersReducedMotion,
} from "../../utils/motion";
import { Spinner } from "../Spinner/Spinner";
import {
	dismissToast,
	removeToast,
	type ToastId,
	type ToastRecord,
	type ToastType,
	toastState,
} from "./toast-store";

export type ToasterPlatform = "mobile" | "desktop";

export type ToasterProps = {
	platform?: ToasterPlatform;
	visibleToasts?: number;
	gap?: number;
	class?: string;
	"aria-label"?: string;
};

const PEEK = 10;
const SCALE_STEP = 0.05;
const PILL_MAX_HEIGHT = 46;
const SWIPE_COMMIT = 48;
const SWIPE_VELOCITY = 0.11;
const SWIPE_SLOP = 6;
const RUBBER_BAND = 0.15;
const EXIT_MS = 200;
const SWIPE_EXIT_MS = 220;
const LAYOUT_MS = 400;
const LAYOUT_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const INTERACTIVE = "button, a, input, textarea, select, [role='button']";

const iconSwapKeyframes: Keyframe[] = [
	{ transform: "scale(0.25)", opacity: 0, filter: "blur(4px)" },
	{ transform: "scale(1)", opacity: 1, filter: "blur(0px)" },
];

const ToastIcon = (props: { type: ToastType }) => (
	<Switch>
		<Match when={props.type === "success"}>
			<CheckCircleIcon class="size-5 text-success" />
		</Match>
		<Match when={props.type === "error"}>
			<DangerCircleIcon class="size-5 text-destructive" />
		</Match>
		<Match when={props.type === "warning"}>
			<DangerTriangleIcon class="size-5 text-warning" />
		</Match>
		<Match when={props.type === "info"}>
			<InfoCircleIcon class="size-5 text-info" />
		</Match>
		<Match when={props.type === "loading"}>
			<Spinner size={20} class="text-muted-foreground" />
		</Match>
	</Switch>
);

type ToastItemContext = {
	platform: Accessor<ToasterPlatform>;
	index: Accessor<number>;
	expanded: Accessor<boolean>;
	revealed: Accessor<boolean>;
	paused: Accessor<boolean>;
	visibleToasts: Accessor<number>;
	frontHeight: Accessor<number>;
	offset: Accessor<number>;
	setHeight: (id: ToastId, height: number) => void;
	setSwiping: (swiping: boolean) => void;
	announce: (record: ToastRecord) => void;
};

const ToastItem = (props: {
	record: ToastRecord;
	context: ToastItemContext;
}) => {
	const record = props.record;
	const ctx = props.context;
	const haptics = useHaptics();
	const [mounted, setMounted] = createSignal(false);
	const [height, setOwnHeight] = createSignal(0);
	const [swipe, setSwipe] = createSignal({ x: 0, y: 0 });
	const [dragging, setDragging] = createSignal(false);
	let iconHost: HTMLSpanElement | undefined;
	let content: HTMLDivElement | undefined;

	const mobile = () => ctx.platform() === "mobile";
	const direction = () => (mobile() ? 1 : -1);
	const card = () => !!record.description || height() > PILL_MAX_HEIGHT;
	const hiddenBehind = () =>
		!record.dismissed && ctx.index() >= ctx.visibleToasts();
	const collapsedBehind = () => !ctx.expanded() && ctx.index() > 0;

	onMount(() => {
		if (!content) return;
		const measure = () => {
			const next = content?.offsetHeight ?? 0;
			setOwnHeight(next);
			ctx.setHeight(record.id, next);
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(content);
		onCleanup(() => observer.disconnect());
		requestAnimationFrame(() => requestAnimationFrame(() => setMounted(true)));
	});

	createEffect(
		on(
			() => record.version,
			() => {
				ctx.announce(record);
				if (record.type === "success") haptics.notification("success");
				else if (record.type === "error") haptics.notification("error");
				else if (record.type === "warning") haptics.notification("warning");
			},
		),
	);

	createEffect(
		on(
			() => record.type,
			() => {
				const glyph = iconHost?.firstElementChild ?? undefined;
				playKeyframes(glyph, iconSwapKeyframes, {
					duration: 220,
					easing: "cubic-bezier(0.2, 0, 0, 1)",
				});
			},
			{ defer: true },
		),
	);

	createEffect(
		on(
			() => [record.version, record.duration, record.dismissed] as const,
			([, duration, dismissed]) => {
				if (dismissed || !Number.isFinite(duration)) return;
				let remaining = duration;
				let startedAt = 0;
				let timer: ReturnType<typeof setTimeout> | undefined;
				const stop = () => {
					if (timer === undefined) return;
					clearTimeout(timer);
					timer = undefined;
					remaining -= performance.now() - startedAt;
				};
				const start = () => {
					if (timer !== undefined) return;
					startedAt = performance.now();
					timer = setTimeout(
						() => {
							timer = undefined;
							record.onAutoClose?.(record.id);
							dismissToast(record.id);
						},
						Math.max(0, remaining),
					);
				};
				createEffect(() => {
					if (ctx.paused() || dragging()) stop();
					else start();
				});
				onCleanup(() => {
					if (timer !== undefined) clearTimeout(timer);
				});
			},
		),
	);

	createEffect(
		on(
			() => record.dismissed,
			(dismissed) => {
				if (!dismissed) return;
				const wait = (record.swiped ? SWIPE_EXIT_MS : EXIT_MS) * motionScale();
				const timer = setTimeout(() => removeToast(record.id), wait);
				onCleanup(() => clearTimeout(timer));
			},
		),
	);

	let pointerId: number | undefined;
	let startX = 0;
	let startY = 0;
	let startedAt = 0;
	let swallowClick = false;

	const axisDelta = (dx: number, dy: number) => (mobile() ? dy : dx);
	const dismissSign = () => (mobile() ? -1 : 1);

	const onPointerDown = (event: PointerEvent) => {
		if (event.button !== 0 || record.dismissed) return;
		pointerId = event.pointerId;
		startX = event.clientX;
		startY = event.clientY;
		startedAt = performance.now();
		swallowClick = false;
	};

	const onPointerMove = (event: PointerEvent) => {
		if (pointerId !== event.pointerId) return;
		const dx = event.clientX - startX;
		const dy = event.clientY - startY;
		const along = axisDelta(dx, dy);
		const across = mobile() ? dx : dy;
		if (!dragging()) {
			if (Math.abs(along) < SWIPE_SLOP) {
				if (Math.abs(across) > SWIPE_SLOP) pointerId = undefined;
				return;
			}
			if (Math.abs(across) > Math.abs(along)) {
				pointerId = undefined;
				return;
			}
			setDragging(true);
			ctx.setSwiping(true);
			try {
				(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
			} catch {}
		}
		const toward = Math.sign(along) === dismissSign();
		const distance = toward ? along : along * RUBBER_BAND;
		setSwipe(mobile() ? { x: 0, y: distance } : { x: distance, y: 0 });
	};

	const finishDrag = (event: PointerEvent, cancelled: boolean) => {
		if (pointerId !== event.pointerId) return;
		pointerId = undefined;
		if (!dragging()) return;
		swallowClick = true;
		const along = axisDelta(event.clientX - startX, event.clientY - startY);
		const elapsed = Math.max(1, performance.now() - startedAt);
		const velocity = Math.abs(along) / elapsed;
		const toward = Math.sign(along) === dismissSign();
		setDragging(false);
		ctx.setSwiping(false);
		if (
			!cancelled &&
			toward &&
			(Math.abs(along) > SWIPE_COMMIT || velocity > SWIPE_VELOCITY)
		) {
			dismissToast(record.id, true);
			return;
		}
		setSwipe({ x: 0, y: 0 });
	};

	const onClickCapture = (event: MouseEvent) => {
		if (!swallowClick) return;
		swallowClick = false;
		event.preventDefault();
		event.stopPropagation();
	};

	const exitTransform = () => {
		if (record.swiped) {
			return mobile()
				? "translate3d(0, calc(-100% - 24px), 0)"
				: "translate3d(calc(100% + 24px), 0, 0)";
		}
		return undefined;
	};

	const transform = () => {
		const exit = exitTransform();
		if (record.dismissed && exit) return exit;
		const { x, y } = swipe();
		if (!mounted()) {
			return `translate3d(0, ${-direction() * 100}%, 0)`;
		}
		const lift = ctx.expanded()
			? direction() * ctx.offset()
			: direction() * Math.min(ctx.index(), ctx.visibleToasts()) * PEEK;
		const scale = ctx.expanded()
			? 1
			: 1 - Math.min(ctx.index(), ctx.visibleToasts()) * SCALE_STEP;
		const shrink = record.dismissed && !record.swiped ? 0.96 : 1;
		return `translate3d(${x}px, ${lift + y}px, 0) scale(${scale * shrink})`;
	};

	const opacity = () => {
		if (!mounted() || record.dismissed || hiddenBehind()) return 0;
		return 1;
	};

	const transition = () => {
		if (dragging()) return "none";
		const scale = motionScale();
		if (record.dismissed) {
			const ms = (record.swiped ? SWIPE_EXIT_MS : EXIT_MS) * scale;
			return `transform ${ms}ms cubic-bezier(0.4, 0, 1, 1), opacity ${ms}ms cubic-bezier(0.4, 0, 1, 1), filter ${ms}ms cubic-bezier(0.4, 0, 1, 1)`;
		}
		const ms = LAYOUT_MS * scale;
		if (prefersReducedMotion()) return `opacity ${ms}ms ${LAYOUT_EASE}`;
		return `transform ${ms}ms ${LAYOUT_EASE}, opacity ${ms}ms ${LAYOUT_EASE}, height ${ms}ms ${LAYOUT_EASE}`;
	};

	const shownHeight = () => {
		if (height() === 0) return undefined;
		if (collapsedBehind()) return `${ctx.frontHeight() || height()}px`;
		return `${height()}px`;
	};

	return (
		<li
			data-toast=""
			data-type={record.type}
			data-index={ctx.index()}
			data-front={ctx.index() === 0 ? "" : undefined}
			data-mounted={mounted() ? "" : undefined}
			data-dismissed={record.dismissed ? "" : undefined}
			data-swiping={dragging() ? "" : undefined}
			data-card={card() ? "" : undefined}
			aria-hidden={hiddenBehind() || record.dismissed ? "true" : undefined}
			inert={hiddenBehind() || record.dismissed || collapsedBehind()}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={(event) => finishDrag(event, false)}
			onPointerCancel={(event) => finishDrag(event, true)}
			on:click={{ handleEvent: onClickCapture, capture: true }}
			class={cx(
				"absolute inset-x-0 overflow-visible select-none [-webkit-user-select:none]",
				mobile() ? "top-0 origin-top" : "bottom-0 origin-bottom",
				"touch-none",
			)}
			style={{
				transform: transform(),
				opacity: opacity(),
				filter: record.dismissed && !record.swiped ? "blur(4px)" : undefined,
				height: shownHeight(),
				transition: transition(),
				"z-index": String(1000 - ctx.index()),
			}}
		>
			<Show when={!mobile()}>
				<button
					type="button"
					data-toast-close=""
					aria-label="Dismiss notification"
					onPointerDown={(event) => event.stopPropagation()}
					onClick={(event) => {
						event.stopPropagation();
						dismissToast(record.id);
					}}
					class={cx(
						"absolute -top-1.5 -left-1.5 z-10 flex size-5 cursor-pointer items-center justify-center rounded-full border border-border bg-popover text-muted-foreground outline-none",
						"before:absolute before:-inset-2 before:content-['']",
						"hover:bg-popover-highlight hover:text-foreground focus-ring",
						"transition-opacity duration-[calc(150ms*var(--motion-scale))] ease-(--ease-out-quick)",
						ctx.revealed() && !collapsedBehind()
							? "opacity-100"
							: "pointer-events-none opacity-0",
					)}
				>
					<CloseIcon class="size-3" aria-hidden="true" />
				</button>
			</Show>
			<div
				data-toast-surface=""
				class={cx(
					"h-full overflow-hidden bg-popover text-foreground shadow-[inset_0_0_0_1px_var(--border),0_8px_8px_2px_var(--shadow-color)]",
					"transition-[border-radius] duration-[calc(300ms*var(--motion-scale))] ease-(--ease-out-quick)",
					record.custom
						? "rounded-sheet"
						: card()
							? "rounded-sheet"
							: "rounded-[22px]",
				)}
			>
				<div
					ref={content}
					class={cx(
						"transition-opacity duration-[calc(200ms*var(--motion-scale))]",
						collapsedBehind() ? "opacity-0" : "opacity-100",
					)}
				>
					<Show
						when={record.custom}
						fallback={
							<div
								class={cx(
									"flex min-h-11 gap-2.5 py-3 pr-4",
									card() ? "items-start" : "items-center",
									record.type === "default" ? "pl-4" : "pl-3",
								)}
							>
								<Show when={record.type !== "default"}>
									<span
										ref={iconHost}
										aria-hidden="true"
										class="flex size-5 shrink-0 items-center justify-center"
									>
										<ToastIcon type={record.type} />
									</span>
								</Show>
								<div class="flex min-w-0 flex-1 flex-col gap-0.5">
									<p class="text-sm leading-5 font-semibold [overflow-wrap:anywhere]">
										{record.title}
									</p>
									<Show when={record.description}>
										<p class="text-sm leading-5 text-pretty text-muted-foreground">
											{record.description}
										</p>
									</Show>
									<Show when={record.action}>
										{(action) => (
											<div
												data-toast-actions=""
												class="-mb-1 mt-1.5 -ml-3 flex flex-wrap items-center gap-1"
											>
												<button
													type="button"
													data-toast-action=""
													onClick={(event) => {
														action().onClick?.(event);
														if (
															action().dismiss !== false &&
															!event.defaultPrevented
														)
															dismissToast(record.id);
													}}
													class={cx(
														"flex h-8 shrink-0 cursor-pointer items-center rounded-control px-3 text-sm font-semibold whitespace-nowrap text-primary-highlight outline-none",
														"hover:bg-popover-highlight focus-ring-inset",
													)}
												>
													{action().label}
												</button>
											</div>
										)}
									</Show>
								</div>
							</div>
						}
					>
						{(render) => render()(record.id)}
					</Show>
				</div>
			</div>
		</li>
	);
};

const isDocumentHidden = () =>
	typeof document !== "undefined" && document.visibilityState === "hidden";

export const Toaster = (props: ToasterProps) => {
	const platform = () => props.platform ?? "desktop";
	const visibleToasts = () => props.visibleToasts ?? 3;
	const gap = () => props.gap ?? 8;
	const [heights, setHeights] = createSignal<Record<string, number>>({});
	const [hovered, setHovered] = createSignal(false);
	const [focusWithin, setFocusWithin] = createSignal(false);
	const [tapExpanded, setTapExpanded] = createSignal(false);
	const [swiping, setSwiping] = createSignal(false);
	const [hidden, setHidden] = createSignal(isDocumentHidden());
	const [politeText, setPoliteText] = createSignal("");
	const [alertText, setAlertText] = createSignal("");
	let list: HTMLOListElement | undefined;

	const ordered = createMemo(() => [...toastState.toasts].reverse());
	const active = createMemo(() =>
		ordered().filter((record) => !record.dismissed),
	);

	createEffect(() => {
		if (active().length <= 1) setTapExpanded(false);
	});

	const expanded = () =>
		active().length > 1 &&
		(hovered() || focusWithin() || tapExpanded() || swiping());

	const revealed = () => hovered() || focusWithin();

	const paused = () =>
		hovered() || focusWithin() || tapExpanded() || swiping() || hidden();

	const heightOf = (record: ToastRecord) => heights()[String(record.id)] ?? 0;

	const frontHeight = () => {
		const front = active()[0];
		return front ? heightOf(front) : 0;
	};

	const offsetFor = (index: number) => {
		let total = 0;
		const items = active();
		for (let i = 0; i < Math.min(index, items.length); i++) {
			total += heightOf(items[i]) + gap();
		}
		return total;
	};

	const listHeight = () => {
		const items = active().slice(0, visibleToasts());
		if (items.length === 0) return 0;
		if (expanded())
			return (
				offsetFor(items.length - 1) + heightOf(items.at(-1) as ToastRecord)
			);
		return frontHeight() + (items.length - 1) * PEEK;
	};

	const setHeight = (id: ToastId, height: number) => {
		setHeights((current) =>
			current[String(id)] === height
				? current
				: { ...current, [String(id)]: height },
		);
	};

	createEffect(
		on(
			() => toastState.toasts.map((record) => String(record.id)),
			(ids) => {
				setHeights((current) => {
					const next: Record<string, number> = {};
					for (const id of ids) if (id in current) next[id] = current[id];
					return next;
				});
			},
		),
	);

	const announce = (record: ToastRecord) => {
		if (!record.announce) return;
		const setter = record.type === "error" ? setAlertText : setPoliteText;
		setter("");
		requestAnimationFrame(() => setter(record.announce));
	};

	onMount(() => {
		const onVisibility = () => setHidden(isDocumentHidden());
		const onKeyDown = (event: KeyboardEvent) => {
			if (!event.altKey || event.code !== "KeyT" || !list) return;
			event.preventDefault();
			const target =
				list.querySelector<HTMLElement>(`li[data-front] ${INTERACTIVE}`) ??
				list;
			target.focus();
		};
		const onOutsidePointer = (event: PointerEvent) => {
			if (!tapExpanded() || !list) return;
			if (event.target instanceof Node && list.contains(event.target)) return;
			setTapExpanded(false);
		};
		document.addEventListener("visibilitychange", onVisibility);
		window.addEventListener("keydown", onKeyDown);
		document.addEventListener("pointerdown", onOutsidePointer, true);
		onCleanup(() => {
			document.removeEventListener("visibilitychange", onVisibility);
			window.removeEventListener("keydown", onKeyDown);
			document.removeEventListener("pointerdown", onOutsidePointer, true);
		});
	});

	const onListClick = (event: MouseEvent) => {
		if (platform() !== "mobile" || active().length <= 1) return;
		const target = event.target as Element | null;
		if (target?.closest(INTERACTIVE)) return;
		setTapExpanded((current) => !current);
	};

	const onListKeyDown = (event: KeyboardEvent) => {
		if (event.key !== "Escape") return;
		const item = (
			document.activeElement as Element | null
		)?.closest<HTMLElement>("li[data-toast]");
		const front = active()[0];
		if (!item && !front) return;
		event.preventDefault();
		event.stopPropagation();
		const index = item ? Number(item.dataset.index) : 0;
		const record = active()[index] ?? front;
		if (record) dismissToast(record.id);
		list?.focus();
	};

	const indexFor = (record: ToastRecord) => {
		let last = 0;
		return createMemo(() => {
			const index = active().indexOf(record);
			if (index >= 0) last = index;
			return last;
		});
	};

	return (
		<Portal>
			<section
				aria-label={props["aria-label"] ?? "Notifications (Alt+T)"}
				data-toaster=""
				data-platform={platform()}
				class={cx(
					"pointer-events-none fixed z-[90]",
					platform() === "mobile"
						? "top-safe-offset-2 left-1/2 w-[min(420px,calc(100vw-32px-var(--safe-area-left,0px)-var(--safe-area-right,0px)))] -translate-x-1/2"
						: "right-[calc(16px+var(--safe-area-right,0px))] bottom-safe-offset-4 w-[min(360px,calc(100vw-32px))]",
					props.class,
				)}
			>
				<ol
					ref={list}
					tabIndex={-1}
					data-expanded={expanded() ? "" : undefined}
					onPointerEnter={(event) => {
						if (event.pointerType === "mouse") setHovered(true);
					}}
					onPointerLeave={(event) => {
						if (event.pointerType === "mouse") setHovered(false);
					}}
					onFocusIn={(event) => {
						const target = event.target as Element;
						if (target.matches(":focus-visible")) setFocusWithin(true);
					}}
					onFocusOut={(event) => {
						const next = event.relatedTarget as Node | null;
						if (!next || !list?.contains(next)) setFocusWithin(false);
					}}
					onClick={onListClick}
					onKeyDown={onListKeyDown}
					class={cx(
						"relative m-0 list-none p-0 outline-none",
						active().length > 0 ? "pointer-events-auto" : "pointer-events-none",
					)}
					style={{
						height: `${listHeight()}px`,
						transition: prefersReducedMotion()
							? undefined
							: `height ${LAYOUT_MS * motionScale()}ms ${LAYOUT_EASE}`,
					}}
				>
					<For each={ordered()}>
						{(record) => {
							const index = indexFor(record);
							return (
								<ToastItem
									record={record}
									context={{
										platform,
										index,
										expanded,
										revealed,
										paused,
										visibleToasts,
										frontHeight,
										offset: () => offsetFor(index()),
										setHeight,
										setSwiping,
										announce,
									}}
								/>
							);
						}}
					</For>
				</ol>
				<div
					class="sr-only"
					role="status"
					aria-live="polite"
					aria-atomic="true"
				>
					{politeText()}
				</div>
				<div class="sr-only" role="alert" aria-atomic="true">
					{alertText()}
				</div>
			</section>
		</Portal>
	);
};
