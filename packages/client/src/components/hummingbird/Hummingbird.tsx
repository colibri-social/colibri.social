import {
	type Component,
	createSignal,
	createUniqueId,
	For,
	onCleanup,
	onMount,
} from "solid-js";
import createMediaQuery from "../../utils/create-media-query";
import { sprite, VIEW_BOX } from "./artwork";

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const TEMPO = 0.95;
const BOB = 1.75;
const FORWARD_ANGLE = 45;
const SMEAR = 2.3;

const NEAR_AXIS = 27;
const FAR_AXIS = 36;

const FULL_FAN = { near: 9, far: 6 };
const SMALL_FAN = { near: 5, far: 3 };
const SMALL_FAN_BELOW = 120;

const DART_RANGE = { x: 36, y: 24 };
const DART_FIRST_DELAY = 2200;
const DART_MIN_GAP = 1800;
const DART_EXTRA_GAP = 2800;

const POKE_DISTANCE = 50;
const POKE_TEMPO_FACTOR = 0.6;
const POKE_DURATION = 800;

interface FanCopy {
	transform: string;
	opacity: string;
	filter: string;
	delay: string;
}

const buildFan = (
	count: number,
	axis: number,
	forward: number,
	maxBlur: number,
): Array<FanCopy> =>
	Array.from({ length: count }, (_, index) => {
		const u = (1 - Math.cos((Math.PI * index) / (count - 1))) / 2;
		const length = Math.cos(u * Math.PI);
		const lean = u * forward;
		const velocity = Math.sin(u * Math.PI);
		return {
			transform: `rotateZ(${(lean - axis).toFixed(2)}deg) scale(1, ${length.toFixed(3)}) rotateZ(${axis}deg)`,
			opacity: (0.05 + 0.15 * Math.abs(length) ** 1.5).toFixed(3),
			filter: `blur(${(0.3 + maxBlur * velocity).toFixed(2)}px)`,
			delay: `${(-index * 0.083).toFixed(3)}s`,
		};
	});

const fanFor = (counts: { near: number; far: number }) => ({
	near: buildFan(counts.near, NEAR_AXIS, -FORWARD_ANGLE, SMEAR),
	far: buildFan(counts.far, FAR_AXIS, -(FORWARD_ANGLE - 5), SMEAR * 1.15),
});

const FANS = { full: fanFor(FULL_FAN), small: fanFor(SMALL_FAN) };

export interface HummingbirdProps {
	size?: number;
	flipped?: boolean;
	dart?: boolean;
	poke?: boolean;
	paused?: boolean;
	frozen?: boolean;
	tempo?: number;
	bob?: number;
	class?: string;
}

export const Hummingbird: Component<HummingbirdProps> = (props) => {
	const uid = createUniqueId();
	const reducedMotion = createMediaQuery(REDUCED_MOTION_QUERY);
	const size = () => props.size ?? 240;
	const fan = () => (size() < SMALL_FAN_BELOW ? FANS.small : FANS.full);

	const [hop, setHop] = createSignal({ x: 0, y: 0 });
	const [startled, setStartled] = createSignal(false);

	let rig: HTMLDivElement | undefined;
	let startleTimer: ReturnType<typeof setTimeout> | undefined;

	onMount(() => {
		if (!props.dart || reducedMotion()) return;

		let timer: ReturnType<typeof setTimeout>;
		const next = () => {
			setHop({
				x: (Math.random() - 0.5) * DART_RANGE.x,
				y: (Math.random() - 0.5) * DART_RANGE.y,
			});
			timer = setTimeout(next, DART_MIN_GAP + Math.random() * DART_EXTRA_GAP);
		};
		timer = setTimeout(next, DART_FIRST_DELAY);
		onCleanup(() => clearTimeout(timer));
	});

	onCleanup(() => clearTimeout(startleTimer));

	const startle = (event: PointerEvent) => {
		if (!props.poke || reducedMotion()) return;

		const box = rig?.getBoundingClientRect();
		if (!box) return;

		const dx = event.clientX - (box.left + box.width / 2);
		const dy = event.clientY - (box.top + box.height / 2);
		const distance = Math.hypot(dx, dy) || 1;

		setHop({
			x: (-dx / distance) * POKE_DISTANCE,
			y: (-dy / distance) * POKE_DISTANCE,
		});
		setStartled(true);
		clearTimeout(startleTimer);
		startleTimer = setTimeout(() => setStartled(false), POKE_DURATION);
	};

	const tempo = () =>
		(props.tempo ?? TEMPO) * (startled() ? POKE_TEMPO_FACTOR : 1);

	const stalled = () => props.paused || props.frozen;

	const layer = "absolute inset-0 h-full w-full overflow-visible";
	const wing =
		"will-change-transform motion-reduce:opacity-100 motion-reduce:blur-none";

	return (
		<div
			class={`relative aspect-square ${props.class ?? ""}`}
			classList={{ "-scale-x-100": props.flipped }}
			style={{
				width: `${size()}px`,
				"--hb-tempo": `${tempo()}`,
				"--hb-bob": `${props.bob ?? BOB}s`,
			}}
			aria-hidden="true"
		>
			<svg class="absolute size-0" innerHTML={sprite(uid)} />

			<div
				ref={rig}
				class="absolute inset-0 transition-transform duration-150 ease-[cubic-bezier(0.2,0.9,0.3,1)] motion-reduce:transition-none"
				style={{ transform: `translate(${hop().x}px, ${hop().y}px)` }}
				onPointerDown={startle}
			>
				<div
					class="hb-rig absolute inset-0 origin-[50%_45%]"
					classList={{ "hb-paused": props.paused }}
				>
					<For each={fan().far}>
						{(copy) => (
							<svg
								class={`${layer} hb-fan origin-[49.75%_46.7%] will-change-[opacity] motion-reduce:hidden`}
								classList={{ "hb-paused": stalled() }}
								viewBox={VIEW_BOX}
								aria-hidden="true"
								style={{
									transform: copy.transform,
									filter: copy.filter,
									opacity: copy.opacity,
									"--o": copy.opacity,
									"animation-delay": copy.delay,
								}}
							>
								<use href={`#hb-far-wing-${uid}`} />
							</svg>
						)}
					</For>

					<svg
						class={`${layer} ${wing} hb-wing-far origin-[49.75%_46.7%] opacity-35 blur-[1.6px]`}
						classList={{ "hb-paused": stalled() }}
						viewBox={VIEW_BOX}
						aria-hidden="true"
					>
						<use href={`#hb-far-wing-${uid}`} />
					</svg>

					<svg class={layer} viewBox={VIEW_BOX} aria-hidden="true">
						<use href={`#hb-body-${uid}`} />
					</svg>

					<For each={fan().near}>
						{(copy) => (
							<svg
								class={`${layer} hb-fan origin-[49.35%_46.1%] will-change-[opacity] motion-reduce:hidden`}
								classList={{ "hb-paused": stalled() }}
								viewBox={VIEW_BOX}
								aria-hidden="true"
								style={{
									transform: copy.transform,
									filter: copy.filter,
									opacity: copy.opacity,
									"--o": copy.opacity,
									"animation-delay": copy.delay,
								}}
							>
								<use href={`#hb-near-wing-${uid}`} />
							</svg>
						)}
					</For>

					<svg
						class={`${layer} ${wing} hb-wing-near origin-[49.35%_46.1%] opacity-45 blur-[1.4px]`}
						classList={{ "hb-paused": stalled() }}
						viewBox={VIEW_BOX}
						aria-hidden="true"
					>
						<use href={`#hb-near-wing-${uid}`} />
					</svg>
				</div>
			</div>
		</div>
	);
};
