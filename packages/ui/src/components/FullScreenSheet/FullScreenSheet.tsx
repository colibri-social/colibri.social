import { Dialog } from "@kobalte/core/dialog";
import { CloseIcon } from "@solar-icons/solid/bold/close";
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
import {
	motionScale,
	prefersReducedMotion,
	springEasing,
	springs,
} from "../../utils/motion";
import {
	createNestedLayers,
	NestedLayerContext,
	revealLayer,
	topLayerAttrs,
} from "../../utils/nested-layers";
import { createSlot } from "../../utils/slot";
import { IconButton } from "../IconButton/IconButton";

export type FullScreenSheetProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: JSX.Element;
	description?: JSX.Element;
	closeLabel?: string;
	footer?: JSX.Element;
	children?: JSX.Element;
	class?: string;
	"aria-label"?: string;
};

export const SHEET_CLOSE_RATIO = 0.25;
const FLICK_VELOCITY = 0.5;
const FLICK_MIN_DISTANCE = 24;
const CLOSE_MIN_MS = 120;
const CLOSE_MAX_MS = 300;
const CLOSE_EASE = "cubic-bezier(0.32, 0, 0.67, 0)";
const CLOSE_MS = 240;
const SETTLE_MS = 220;
const SETTLE_EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";
const VELOCITY_WINDOW_MS = 100;

type Sample = { y: number; t: number };

export const FullScreenSheet = (props: FullScreenSheetProps) => {
	const [local] = splitProps(props, ["children"]);
	const layers = createNestedLayers();
	const description = createSlot(() => props.description);
	const footer = createSlot(() => props.footer);
	const [present, setPresent] = createSignal(props.open);
	let content: HTMLDivElement | undefined;
	let overlay: HTMLDivElement | undefined;
	let offset = 0;
	let exitVelocity = 0;
	let running: Animation | undefined;
	let dragging = false;
	let pointerId: number | undefined;
	let startY = 0;
	let samples: Sample[] = [];

	const height = () => content?.getBoundingClientRect().height ?? 1;

	const paint = (next: number) => {
		offset = next;
		if (content) {
			content.style.transform = next === 0 ? "" : `translate3d(0,${next}px,0)`;
		}
		if (overlay) {
			overlay.style.opacity = String(Math.max(0, 1 - next / height()));
		}
	};

	const stopRunning = () => {
		running?.cancel();
		running = undefined;
	};

	const animateTo = (
		to: number,
		duration: number,
		easing: string,
	): Promise<void> => {
		stopRunning();
		if (!content || prefersReducedMotion()) {
			paint(to);
			return Promise.resolve();
		}
		const from = offset;
		const animation = content.animate(
			[
				{ transform: `translate3d(0,${from}px,0)` },
				{ transform: `translate3d(0,${to}px,0)` },
			],
			{ duration: duration * motionScale(), easing, fill: "forwards" },
		);
		overlay?.animate(
			[
				{ opacity: Math.max(0, 1 - from / height()) },
				{ opacity: Math.max(0, 1 - to / height()) },
			],
			{ duration: duration * motionScale(), easing, fill: "forwards" },
		);
		running = animation;
		return animation.finished.then(
			() => {
				if (running !== animation) return;
				paint(to);
				animation.cancel();
				overlay?.getAnimations().forEach((entry) => {
					entry.cancel();
				});
				running = undefined;
			},
			() => undefined,
		);
	};

	const enter = () => {
		if (!content) return;
		const size = height();
		paint(size);
		const { easing, duration } = springEasing(springs.sheet);
		void animateTo(0, duration, easing);
	};

	const exit = async () => {
		const size = height();
		const remaining = Math.max(0, size - offset);
		const velocity = exitVelocity;
		exitVelocity = 0;
		if (velocity >= FLICK_VELOCITY) {
			const duration = Math.min(
				CLOSE_MAX_MS,
				Math.max(CLOSE_MIN_MS, remaining / velocity),
			);
			await animateTo(size, duration, "linear");
		} else {
			await animateTo(size, CLOSE_MS, CLOSE_EASE);
		}
		setPresent(false);
	};

	createEffect(
		on(
			() => props.open,
			(open) => {
				if (open) {
					setPresent(true);
					return;
				}
				if (present()) void exit();
			},
			{ defer: true },
		),
	);

	const requestClose = (velocity = 0) => {
		exitVelocity = velocity;
		props.onOpenChange(false);
		queueMicrotask(() => {
			if (props.open) {
				exitVelocity = 0;
				void animateTo(0, SETTLE_MS, SETTLE_EASE);
			}
		});
	};

	const velocityOf = (now: number) => {
		const recent = samples.filter(
			(sample) => now - sample.t <= VELOCITY_WINDOW_MS,
		);
		const first = recent[0];
		const last = recent[recent.length - 1];
		if (!first || !last || first === last || last.t === first.t) return 0;
		return (last.y - first.y) / (last.t - first.t);
	};

	const onGrabDown = (event: PointerEvent) => {
		if (event.button !== 0 || !event.isPrimary) return;
		const target = event.target as Element | null;
		if (target?.closest("button, a, input, textarea, [role='button']")) return;
		stopRunning();
		dragging = true;
		pointerId = event.pointerId;
		startY = event.clientY - offset;
		samples = [{ y: event.clientY, t: event.timeStamp }];
		try {
			(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		} catch {}
	};

	const onGrabMove = (event: PointerEvent) => {
		if (!dragging || event.pointerId !== pointerId) return;
		samples.push({ y: event.clientY, t: event.timeStamp });
		if (samples.length > 12) samples.shift();
		const raw = event.clientY - startY;
		paint(raw < 0 ? raw * 0.2 : raw);
	};

	const onGrabUp = (event: PointerEvent) => {
		if (!dragging || event.pointerId !== pointerId) return;
		dragging = false;
		pointerId = undefined;
		samples.push({ y: event.clientY, t: event.timeStamp });
		const velocity = velocityOf(event.timeStamp);
		const shouldClose =
			offset > height() * SHEET_CLOSE_RATIO ||
			(velocity >= FLICK_VELOCITY && offset > FLICK_MIN_DISTANCE);
		if (shouldClose) {
			requestClose(Math.max(velocity, FLICK_VELOCITY));
			return;
		}
		void animateTo(0, SETTLE_MS, SETTLE_EASE);
	};

	const onGrabCancel = () => {
		if (!dragging) return;
		dragging = false;
		pointerId = undefined;
		void animateTo(0, SETTLE_MS, SETTLE_EASE);
	};

	onCleanup(stopRunning);

	const grab = {
		"data-full-screen-sheet-grab": "",
		onPointerDown: onGrabDown,
		onPointerMove: onGrabMove,
		onPointerUp: onGrabUp,
		onPointerCancel: onGrabCancel,
	};

	return (
		<Dialog
			open={present()}
			onOpenChange={(next) => {
				if (!next) requestClose();
			}}
			modal
			preventScroll
		>
			<NestedLayerContext.Provider value={layers}>
				<Dialog.Portal>
					<div
						ref={overlay}
						aria-hidden="true"
						class="fixed inset-0 z-50 bg-overlay"
					/>
					<Dialog.Content
						{...topLayerAttrs}
						ref={(element: HTMLDivElement) => {
							content = element;
							revealLayer(element);
							queueMicrotask(enter);
						}}
						aria-label={props["aria-label"]}
						data-full-screen-sheet=""
						tabIndex={-1}
						onOpenAutoFocus={(event: Event) => {
							event.preventDefault();
							content?.focus({ preventScroll: true });
						}}
						onInteractOutside={(event: Event) => event.preventDefault()}
						class={cx(
							"fixed inset-0 z-50 flex flex-col bg-popover pt-safe text-foreground outline-none",
							props.class,
						)}
					>
						<div {...grab} class="shrink-0 touch-none select-none">
							<div class="flex h-11 items-center px-3 py-1.5">
								<Dialog.CloseButton
									as={(
										closeProps: JSX.ButtonHTMLAttributes<HTMLButtonElement>,
									) => (
										<IconButton
											{...closeProps}
											variant="ghost"
											size="md"
											label={props.closeLabel ?? "Close"}
											icon={<CloseIcon />}
											class="[&_svg]:size-5"
										/>
									)}
								/>
							</div>
							<div class="flex flex-col items-center gap-2 px-12 pt-2.5 pb-6 text-center">
								<Dialog.Title class="m-0 text-xl leading-tight font-bold text-balance">
									{props.title}
								</Dialog.Title>
								<Show when={description.has()}>
									<Dialog.Description class="m-0 text-sm text-balance">
										{description()}
									</Dialog.Description>
								</Show>
							</div>
						</div>
						<div
							data-full-screen-sheet-body=""
							class="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-4 pb-4 [&>*]:shrink-0"
						>
							{local.children}
						</div>
						<Show when={footer.has()}>
							<div
								data-full-screen-sheet-footer=""
								class="shrink-0 bg-popover px-4 pt-3 pb-safe-offset-4"
							>
								{footer()}
							</div>
						</Show>
					</Dialog.Content>
				</Dialog.Portal>
			</NestedLayerContext.Provider>
		</Dialog>
	);
};
