import { AltArrowDownIcon } from "@solar-icons/solid/bold/alt-arrow-down";
import { AltArrowUpIcon } from "@solar-icons/solid/bold/alt-arrow-up";
import { TransferVerticalIcon } from "@solar-icons/solid/bold/transfer-vertical";
import {
	createEffect,
	createMemo,
	createSignal,
	For,
	on,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import { AnimatedMicrophoneIcon } from "../../icons/animated/icons";
import { AnimatedHeadphonesIcon } from "../../icons/animated/media";
import { cx } from "../../utils/cx";
import {
	motionScale,
	prefersReducedMotion,
	type SpringConfig,
	springs,
} from "../../utils/motion";
import { formatClock } from "../Media/format";
import { CallControlButton, CallLeaveButton } from "./CallControls";
import { SpeakingAvatar, type VoiceParticipant } from "./shared";

export type CallPillPosition = "top" | "bottom";

export type CallPillProps = {
	participants: VoiceParticipant[];
	channelName: string;
	spaceName?: string;
	startedAt: Date | number;
	muted?: boolean;
	deafened?: boolean;
	expanded?: boolean;
	defaultExpanded?: boolean;
	onExpandedChange?: (expanded: boolean) => void;
	position?: CallPillPosition;
	defaultPosition?: CallPillPosition;
	onPositionChange?: (position: CallPillPosition) => void;
	avoidTop?: number;
	avoidBottom?: number;
	contained?: boolean;
	onToggleMute?: () => void;
	onToggleDeafen?: () => void;
	onOpenCall?: () => void;
	onLeave?: () => void;
	class?: string;
};

const COLLAPSE_SWIPE = 28;
const DRAG_SLOP = 8;
const VELOCITY_WINDOW_MS = 100;
const MIN_VELOCITY_SPAN_MS = 8;
const MAX_VELOCITY = 4000;
const DECELERATION = 0.998;
const RUBBER_BAND = 0.55;
const STEP_MS = 1000 / 240;
const MAX_FRAME_MS = 64;
const REST_DISTANCE = 0.5;
const REST_VELOCITY = 5;

const morphSpring: SpringConfig = springs.overlayIn;
const snapSpring: SpringConfig = { stiffness: 247, damping: 25 };

type SpringChannel = {
	value: number;
	velocity: number;
	target: number;
	config: SpringConfig;
	running: boolean;
};

const createChannel = (): SpringChannel => ({
	value: 0,
	velocity: 0,
	target: 0,
	config: morphSpring,
	running: false,
});

const stepChannel = (channel: SpringChannel, dt: number) => {
	const mass = channel.config.mass ?? 1;
	const force =
		-channel.config.stiffness * (channel.value - channel.target) -
		channel.config.damping * channel.velocity;
	channel.velocity += (force / mass) * dt;
	channel.value += channel.velocity * dt;
	if (
		Math.abs(channel.value - channel.target) < REST_DISTANCE &&
		Math.abs(channel.velocity) < REST_VELOCITY
	) {
		channel.value = channel.target;
		channel.velocity = 0;
		channel.running = false;
	}
};

const retarget = (
	channel: SpringChannel,
	from: number,
	to: number,
	config: SpringConfig,
	velocity?: number,
) => {
	if (!channel.running) channel.velocity = 0;
	if (velocity !== undefined) channel.velocity = velocity;
	channel.value = from;
	channel.target = to;
	channel.config = config;
	channel.running = from !== to || channel.velocity !== 0;
};

const projectMomentum = (velocity: number) =>
	((velocity / 1000) * DECELERATION) / (1 - DECELERATION);

const rubberBand = (overshoot: number, dimension: number) =>
	(overshoot * dimension * RUBBER_BAND) /
	(dimension + RUBBER_BAND * Math.abs(overshoot));

type VelocitySample = { y: number; t: number };

const releaseVelocity = (samples: VelocitySample[]) => {
	const first = samples[0];
	const last = samples.at(-1);
	if (!first || !last) return 0;
	const span = last.t - first.t;
	if (span < MIN_VELOCITY_SPAN_MS) return 0;
	const velocity = ((last.y - first.y) / span) * 1000;
	return Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, velocity));
};

type DragGesture = {
	id: number;
	startX: number;
	startY: number;
	mode: "pending" | "move" | "collapse";
	baseOffset: number;
	minOffset: number;
	maxOffset: number;
	span: number;
	samples: VelocitySample[];
};

const shownParticipants = (participants: VoiceParticipant[], max: number) => {
	const speaking = participants.filter((participant) => participant.speaking);
	const quiet = participants.filter((participant) => !participant.speaking);
	return [...speaking, ...quiet].slice(0, max);
};

const AvatarStack = (props: {
	participants: VoiceParticipant[];
	max: number;
	size: "xs" | "base";
}) => (
	<span data-call-pill-avatars="" class="flex shrink-0 items-center">
		<For each={shownParticipants(props.participants, props.max)}>
			{(participant, index) => (
				<SpeakingAvatar
					name={participant.name}
					src={participant.avatarSrc}
					speaking={participant.speaking}
					size={props.size}
					class={cx(
						index() > 0 && (props.size === "xs" ? "-ml-1.5" : "-ml-2.5"),
					)}
				/>
			)}
		</For>
	</span>
);

export const CallPill = (props: CallPillProps) => {
	const [localExpanded, setLocalExpanded] = createSignal(
		props.defaultExpanded ?? false,
	);
	const expanded = () => props.expanded ?? localExpanded();
	const [shownExpanded, setShownExpanded] = createSignal(expanded());
	const [localPosition, setLocalPosition] = createSignal<CallPillPosition>(
		props.defaultPosition ?? "top",
	);
	const position = () => props.position ?? localPosition();
	const [shownPosition, setShownPosition] = createSignal(position());
	const [animating, setAnimating] = createSignal(false);
	const [dragging, setDragging] = createSignal(false);
	const [now, setNow] = createSignal(Date.now());
	let layer: HTMLDivElement | undefined;
	let pill: HTMLDivElement | undefined;

	onMount(() => {
		const timer = window.setInterval(() => setNow(Date.now()), 1000);
		onCleanup(() => window.clearInterval(timer));
	});

	const elapsed = createMemo(() => {
		const start =
			props.startedAt instanceof Date
				? props.startedAt.getTime()
				: props.startedAt;
		return formatClock((now() - start) / 1000);
	});

	const speakingCount = () =>
		props.participants.filter((participant) => participant.speaking).length;

	const summary = () => {
		const speakers = props.participants.filter(
			(participant) => participant.speaking,
		);
		if (speakers.length === 1) return `${speakers[0]?.name} is speaking`;
		if (speakers.length > 1) return `${speakers.length} people are speaking`;
		return `${props.participants.length} in call`;
	};

	const offsetY = createChannel();
	const width = createChannel();
	const height = createChannel();
	let sizeLocked = false;
	let frame = 0;
	let lastFrame = 0;

	const paint = () => {
		if (!pill) return;
		pill.style.transform =
			offsetY.value === 0 ? "" : `translate3d(0, ${offsetY.value}px, 0)`;
		pill.style.width = sizeLocked ? `${width.value}px` : "";
		pill.style.height = sizeLocked ? `${height.value}px` : "";
	};

	const settleAll = () => {
		for (const channel of [offsetY, width, height]) {
			channel.value = channel.target;
			channel.velocity = 0;
			channel.running = false;
		}
		offsetY.value = 0;
		offsetY.target = 0;
		sizeLocked = false;
		if (frame) cancelAnimationFrame(frame);
		frame = 0;
		lastFrame = 0;
		paint();
		setAnimating(false);
	};

	const tick = (time: number) => {
		const elapsedMs =
			lastFrame === 0 ? STEP_MS : Math.min(time - lastFrame, MAX_FRAME_MS);
		lastFrame = time;
		const steps = Math.max(1, Math.round(elapsedMs / motionScale() / STEP_MS));
		const dt = STEP_MS / 1000;
		for (let index = 0; index < steps; index++) {
			for (const channel of [offsetY, width, height]) {
				if (channel.running) stepChannel(channel, dt);
			}
		}
		if (!width.running && !height.running) sizeLocked = false;
		paint();
		if (offsetY.running || width.running || height.running) {
			frame = requestAnimationFrame(tick);
			return;
		}
		frame = 0;
		lastFrame = 0;
		setAnimating(false);
	};

	const run = () => {
		if (!offsetY.running && !width.running && !height.running) {
			settleAll();
			return;
		}
		setAnimating(true);
		if (!frame) {
			lastFrame = 0;
			frame = requestAnimationFrame(tick);
		}
	};

	onCleanup(() => {
		if (frame) cancelAnimationFrame(frame);
	});

	const transition = (
		change: () => void,
		options: { velocity?: number; config?: SpringConfig } = {},
	) => {
		if (!pill || prefersReducedMotion()) {
			change();
			settleAll();
			return;
		}
		const live = pill.getBoundingClientRect();
		change();
		pill.style.transform = "";
		pill.style.width = "";
		pill.style.height = "";
		const target = pill.getBoundingClientRect();
		pill.style.width = `${live.width}px`;
		pill.style.height = `${live.height}px`;
		const anchored = pill.getBoundingClientRect();
		retarget(
			offsetY,
			live.top - anchored.top,
			0,
			options.config ?? morphSpring,
			options.velocity,
		);
		retarget(width, live.width, target.width, morphSpring);
		retarget(height, live.height, target.height, morphSpring);
		sizeLocked = width.running || height.running;
		paint();
		run();
	};

	const setExpanded = (next: boolean) => {
		transition(() => {
			setLocalExpanded(next);
			props.onExpandedChange?.(next);
			setShownExpanded(expanded());
		});
	};

	const expand = () => {
		if (!shownExpanded()) setExpanded(true);
	};
	const collapse = () => {
		if (shownExpanded()) setExpanded(false);
	};

	const moveTo = (next: CallPillPosition, velocity?: number) => {
		transition(
			() => {
				if (next !== position()) {
					setLocalPosition(next);
					props.onPositionChange?.(next);
				}
				setShownPosition(position());
			},
			velocity === undefined ? {} : { velocity, config: snapSpring },
		);
	};

	const otherSide = (): CallPillPosition =>
		shownPosition() === "top" ? "bottom" : "top";

	createEffect(
		on(
			expanded,
			() => {
				queueMicrotask(() => {
					if (expanded() !== shownExpanded())
						transition(() => setShownExpanded(expanded()));
				});
			},
			{ defer: true },
		),
	);

	createEffect(
		on(
			position,
			() => {
				queueMicrotask(() => {
					if (position() !== shownPosition() && !dragging())
						transition(() => setShownPosition(position()));
				});
			},
			{ defer: true },
		),
	);

	onMount(() => {
		const onPointerDown = (event: PointerEvent) => {
			if (!shownExpanded() || !pill) return;
			if (event.target instanceof Node && pill.contains(event.target)) return;
			collapse();
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape" && shownExpanded()) collapse();
		};
		document.addEventListener("pointerdown", onPointerDown, true);
		document.addEventListener("keydown", onKeyDown);
		onCleanup(() => {
			document.removeEventListener("pointerdown", onPointerDown, true);
			document.removeEventListener("keydown", onKeyDown);
		});
	});

	let gesture: DragGesture | undefined;
	let swallowClick = false;

	const beginMove = (event: PointerEvent, active: DragGesture, dy: number) => {
		if (!pill || !layer) return;
		const rect = pill.getBoundingClientRect();
		const bounds = layer.getBoundingClientRect();
		const style = getComputedStyle(layer);
		const naturalTop = rect.top - offsetY.value;
		offsetY.running = false;
		active.mode = "move";
		active.baseOffset = offsetY.value - dy;
		active.minOffset =
			bounds.top + Number.parseFloat(style.paddingTop) - naturalTop;
		active.maxOffset =
			bounds.bottom -
			Number.parseFloat(style.paddingBottom) -
			(naturalTop + rect.height);
		active.span = Math.max(1, bounds.height);
		setDragging(true);
		try {
			pill.setPointerCapture(event.pointerId);
		} catch {}
	};

	const trackMove = (active: DragGesture, dy: number) => {
		const raw = active.baseOffset + dy;
		let next = raw;
		if (raw < active.minOffset)
			next = active.minOffset + rubberBand(raw - active.minOffset, active.span);
		else if (raw > active.maxOffset)
			next = active.maxOffset + rubberBand(raw - active.maxOffset, active.span);
		offsetY.value = next;
		offsetY.target = next;
		offsetY.velocity = 0;
		paint();
	};

	const onDragStart = (event: PointerEvent) => {
		if (event.pointerType === "mouse" && event.button !== 0) return;
		swallowClick = false;
		gesture = {
			id: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			mode: "pending",
			baseOffset: 0,
			minOffset: 0,
			maxOffset: 0,
			span: 1,
			samples: [{ y: event.clientY, t: event.timeStamp }],
		};
	};

	const onDragMove = (event: PointerEvent) => {
		const active = gesture;
		if (!active || active.id !== event.pointerId) return;
		const dx = event.clientX - active.startX;
		const dy = event.clientY - active.startY;
		active.samples.push({ y: event.clientY, t: event.timeStamp });
		while (
			active.samples.length > 2 &&
			event.timeStamp - (active.samples[0]?.t ?? 0) > VELOCITY_WINDOW_MS
		)
			active.samples.shift();
		if (active.mode === "pending") {
			if (Math.abs(dy) < DRAG_SLOP) {
				if (Math.abs(dx) > DRAG_SLOP) gesture = undefined;
				return;
			}
			if (Math.abs(dx) > Math.abs(dy)) {
				gesture = undefined;
				return;
			}
			const towardEdge = shownPosition() === "top" ? dy < 0 : dy > 0;
			if (shownExpanded() && towardEdge && event.pointerType !== "mouse") {
				active.mode = "collapse";
			} else {
				beginMove(event, active, dy);
			}
		}
		if (active.mode === "collapse") {
			if (Math.abs(dy) > COLLAPSE_SWIPE) {
				gesture = undefined;
				swallowClick = true;
				collapse();
			}
			return;
		}
		trackMove(active, dy);
	};

	const onDragEnd = (event: PointerEvent, cancelled: boolean) => {
		const active = gesture;
		if (!active || active.id !== event.pointerId) return;
		gesture = undefined;
		if (active.mode !== "move") return;
		swallowClick = true;
		setDragging(false);
		if (!pill || !layer || cancelled) {
			moveTo(shownPosition(), 0);
			return;
		}
		const velocity = releaseVelocity(active.samples);
		const rect = pill.getBoundingClientRect();
		const bounds = layer.getBoundingClientRect();
		const projected = rect.top + rect.height / 2 + projectMomentum(velocity);
		const midpoint = bounds.top + bounds.height / 2;
		moveTo(projected > midpoint ? "bottom" : "top", velocity);
	};

	const onClickCapture = (event: MouseEvent) => {
		if (!swallowClick) return;
		swallowClick = false;
		event.preventDefault();
		event.stopPropagation();
	};

	return (
		<div
			ref={layer}
			data-call-pill-layer=""
			class={cx(
				"pointer-events-none inset-0 z-40 flex flex-col items-center px-safe-offset-3 pt-safe-offset-2 pb-safe-offset-2",
				shownPosition() === "bottom" ? "justify-end" : "justify-start",
				props.contained ? "absolute" : "fixed",
				props.class,
			)}
		>
			<div
				ref={pill}
				data-call-pill=""
				data-expanded={shownExpanded() ? "" : undefined}
				data-position={shownPosition()}
				data-animating={animating() ? "" : undefined}
				data-dragging={dragging() ? "" : undefined}
				onPointerDown={onDragStart}
				onPointerMove={onDragMove}
				onPointerUp={(event) => onDragEnd(event, false)}
				onPointerCancel={(event) => onDragEnd(event, true)}
				on:click={{ handleEvent: onClickCapture, capture: true }}
				class={cx(
					"pointer-events-auto shrink-0 touch-none overflow-hidden border border-white/10 bg-black text-white shadow-[0_8px_24px_rgb(0_0_0/0.45)] select-none [-webkit-user-select:none]",
					shownExpanded()
						? "w-full max-w-[400px] rounded-sheet"
						: "h-9 w-auto max-w-[calc(100%-88px)] rounded-full",
				)}
				style={{
					"margin-top":
						shownPosition() === "top" && shownExpanded() && props.avoidTop
							? `${props.avoidTop}px`
							: undefined,
					"margin-bottom":
						shownPosition() === "bottom" && props.avoidBottom
							? `${props.avoidBottom}px`
							: undefined,
				}}
			>
				<Show
					when={shownExpanded()}
					fallback={
						<button
							type="button"
							aria-expanded="false"
							onClick={expand}
							class="flex h-full min-w-0 max-w-full cursor-pointer items-center gap-2 border-0 bg-transparent py-0 pr-3 pl-2 text-white outline-none focus-ring-inset"
						>
							<AvatarStack
								participants={props.participants}
								max={3}
								size="xs"
							/>
							<span class="min-w-0 truncate text-left text-xs font-semibold">
								{props.channelName}
								<span class="sr-only"> call, {summary()},</span>
							</span>
							<span class="flex shrink-0 items-center gap-1 text-xs text-success tabular-nums">
								<span
									aria-hidden="true"
									class="size-1.5 rounded-full bg-success"
								/>
								{elapsed()}
								<span class="sr-only">, show call controls</span>
							</span>
						</button>
					}
				>
					<section
						aria-label={`${props.channelName} call`}
						class="flex flex-col gap-3 p-3"
					>
						<div class="flex min-w-0 items-center gap-3">
							<AvatarStack
								participants={props.participants}
								max={3}
								size="base"
							/>
							<button
								type="button"
								onClick={() => props.onOpenCall?.()}
								class="flex min-w-0 flex-1 cursor-pointer flex-col border-0 bg-transparent p-0 text-left text-white outline-none focus-visible:underline"
							>
								<span class="truncate text-sm font-semibold">
									{props.channelName}
								</span>
								<span class="truncate text-xs text-white/60 tabular-nums">
									{props.spaceName ? `${props.spaceName} · ` : ""}
									{elapsed()}
									<Show when={speakingCount() > 0}>
										<span class="sr-only">, {summary()}</span>
									</Show>
								</span>
							</button>
							<button
								type="button"
								aria-label={
									otherSide() === "bottom" ? "Move to bottom" : "Move to top"
								}
								title={
									otherSide() === "bottom" ? "Move to bottom" : "Move to top"
								}
								onClick={() => moveTo(otherSide())}
								class="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-control-sm border-0 bg-white/10 text-white outline-none hover:bg-white/15 focus-ring [&_svg]:size-5"
							>
								<TransferVerticalIcon />
							</button>
							<button
								type="button"
								aria-expanded="true"
								aria-label="Hide call controls"
								onClick={collapse}
								class="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-control-sm border-0 bg-white/10 text-white outline-none hover:bg-white/15 focus-ring [&_svg]:size-5"
							>
								<Show
									when={shownPosition() === "bottom"}
									fallback={<AltArrowUpIcon />}
								>
									<AltArrowDownIcon />
								</Show>
							</button>
						</div>
						<div class="flex min-w-0 items-center gap-2">
							<CallControlButton
								size="lg"
								stretch
								label={props.muted ? "Unmute" : "Mute"}
								pressed={!!props.muted}
								tone={props.muted ? "off" : "default"}
								icon={<AnimatedMicrophoneIcon muted={!!props.muted} />}
								onClick={() => props.onToggleMute?.()}
								class="min-w-0 flex-1"
							/>
							<Show when={props.onToggleDeafen}>
								<CallControlButton
									size="lg"
									stretch
									label={props.deafened ? "Undeafen" : "Deafen"}
									pressed={!!props.deafened}
									tone={props.deafened ? "off" : "default"}
									icon={<AnimatedHeadphonesIcon deafened={!!props.deafened} />}
									onClick={() => props.onToggleDeafen?.()}
									class="min-w-0 flex-1"
								/>
							</Show>
							<button
								type="button"
								onClick={() => props.onOpenCall?.()}
								class="flex h-10 min-w-0 flex-[2] cursor-pointer items-center justify-center truncate rounded-control border border-white/10 bg-white/10 px-2 text-sm font-semibold text-white outline-none hover:bg-white/15 focus-ring"
							>
								Open call
							</button>
							<CallLeaveButton
								size="lg"
								stretch
								onClick={() => props.onLeave?.()}
								class="min-w-0 flex-1"
							/>
						</div>
					</section>
				</Show>
			</div>
		</div>
	);
};
