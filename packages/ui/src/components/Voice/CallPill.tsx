import { AltArrowUpIcon } from "@solar-icons/solid/bold/alt-arrow-up";
import {
	createMemo,
	createSignal,
	For,
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
	springEasing,
	springs,
} from "../../utils/motion";
import { formatClock } from "../Media/format";
import { CallControlButton, CallLeaveButton } from "./CallControls";
import { SpeakingAvatar, type VoiceParticipant } from "./shared";

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
	avoidTop?: number;
	contained?: boolean;
	onToggleMute?: () => void;
	onToggleDeafen?: () => void;
	onOpenCall?: () => void;
	onLeave?: () => void;
	class?: string;
};

const COLLAPSE_SWIPE = 28;

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
	const [now, setNow] = createSignal(Date.now());
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

	const morph = (next: boolean) => {
		if (!pill || prefersReducedMotion() || !pill.animate) {
			setLocalExpanded(next);
			props.onExpandedChange?.(next);
			return;
		}
		const before = pill.getBoundingClientRect();
		setLocalExpanded(next);
		props.onExpandedChange?.(next);
		const after = pill.getBoundingClientRect();
		const { easing, duration } = springEasing(springs.overlayIn);
		pill.getAnimations().forEach((animation) => {
			animation.cancel();
		});
		pill.animate(
			[
				{
					width: `${before.width}px`,
					height: `${before.height}px`,
					transform: `translateY(${before.top - after.top}px)`,
				},
				{
					width: `${after.width}px`,
					height: `${after.height}px`,
					transform: "translateY(0)",
				},
			],
			{ duration: duration * motionScale(), easing },
		);
	};

	const expand = () => {
		if (!expanded()) morph(true);
	};
	const collapse = () => {
		if (expanded()) morph(false);
	};

	onMount(() => {
		const onPointerDown = (event: PointerEvent) => {
			if (!expanded() || !pill) return;
			if (event.target instanceof Node && pill.contains(event.target)) return;
			collapse();
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape" && expanded()) collapse();
		};
		document.addEventListener("pointerdown", onPointerDown, true);
		document.addEventListener("keydown", onKeyDown);
		onCleanup(() => {
			document.removeEventListener("pointerdown", onPointerDown, true);
			document.removeEventListener("keydown", onKeyDown);
		});
	});

	let swipeStart: { id: number; y: number } | undefined;
	const onSwipeStart = (event: PointerEvent) => {
		if (!expanded() || event.pointerType === "mouse") return;
		swipeStart = { id: event.pointerId, y: event.clientY };
	};
	const onSwipeMove = (event: PointerEvent) => {
		if (!swipeStart || swipeStart.id !== event.pointerId) return;
		if (swipeStart.y - event.clientY > COLLAPSE_SWIPE) {
			swipeStart = undefined;
			collapse();
		}
	};
	const onSwipeEnd = () => {
		swipeStart = undefined;
	};

	return (
		<div
			data-call-pill-layer=""
			class={cx(
				"pointer-events-none inset-x-0 top-0 z-40 flex justify-center px-safe-offset-3 pt-safe-offset-2",
				props.contained ? "absolute" : "fixed",
				props.class,
			)}
		>
			<div
				ref={pill}
				data-call-pill=""
				data-expanded={expanded() ? "" : undefined}
				onPointerDown={onSwipeStart}
				onPointerMove={onSwipeMove}
				onPointerUp={onSwipeEnd}
				onPointerCancel={onSwipeEnd}
				class={cx(
					"pointer-events-auto overflow-hidden border border-white/10 bg-black text-white shadow-[0_8px_24px_rgb(0_0_0/0.45)]",
					expanded()
						? "w-full max-w-[400px] rounded-sheet"
						: "h-9 w-auto max-w-[calc(100%-88px)] rounded-full",
				)}
				style={{
					"margin-top":
						expanded() && props.avoidTop ? `${props.avoidTop}px` : undefined,
				}}
			>
				<Show
					when={expanded()}
					fallback={
						<button
							type="button"
							aria-expanded="false"
							onClick={expand}
							class="flex h-full min-w-0 max-w-full cursor-pointer items-center gap-2 border-0 bg-transparent py-0 pr-3 pl-2 text-white outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--primary)]"
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
								aria-expanded="true"
								aria-label="Hide call controls"
								onClick={collapse}
								class="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-control-sm border-0 bg-white/10 text-white outline-none hover:bg-white/15 focus-visible:shadow-[0_0_0_2px_var(--primary)] [&_svg]:size-5"
							>
								<AltArrowUpIcon />
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
								class="flex h-10 min-w-0 flex-[2] cursor-pointer items-center justify-center truncate rounded-control border border-white/10 bg-white/10 px-2 text-sm font-semibold text-white outline-none hover:bg-white/15 focus-visible:shadow-[0_0_0_2px_var(--primary)]"
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
