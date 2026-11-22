import {
	createEffect,
	createMemo,
	createSignal,
	onCleanup,
	Show,
	untrack,
} from "solid-js";
import { cx } from "../../utils/cx";
import { reducedMotionActive } from "../../utils/playback";
import { Hummingbird } from "../Hummingbird/Hummingbird";
import { tipSlotAt } from "./tip-schedule";

export const LOADING_BIRD_SIZE = 170;
export const DEFAULT_TIP_DELAY = 1200;
export const DEFAULT_TIP_INTERVAL = 6000;
export const DEFAULT_TIRED_AFTER = 8000;

const ART_OFFSET_X = -4.086;
const ART_OFFSET_Y = -0.408;
const TIRED_SINK = 6;
const RESTING_BOB = 1.75;
const TIRED_BOB = 2.8;
const TIP_GAP = 32;

const ENTRANCE =
	"animate-[ui-fade-in_calc(480ms*var(--motion-scale))_var(--ease-out-quick)_both] motion-reduce:animate-none reduced-motion:animate-none";

export type LoadingScreenProps = {
	label?: string;
	tips?: readonly string[];
	tipStart?: number;
	tipDelay?: number;
	tipInterval?: number;
	tiredAfter?: number;
	since?: number;
	birdSize?: number;
	class?: string;
};

export const LoadingScreen = (props: LoadingScreenProps) => {
	const mountedAt = performance.now();
	const startedAt = untrack(() => props.since) ?? mountedAt;
	const since = () => startedAt;
	const [now, setNow] = createSignal(mountedAt, { equals: false });
	const size = () => props.birdSize ?? LOADING_BIRD_SIZE;

	const slot = createMemo(() =>
		tipSlotAt(now() - since(), {
			count: props.tips?.length ?? 0,
			start: props.tipStart ?? 0,
			delay: props.tipDelay ?? DEFAULT_TIP_DELAY,
			interval: props.tipInterval ?? DEFAULT_TIP_INTERVAL,
		}),
	);

	createEffect(() => {
		const wait = slot().nextChangeIn;
		if (wait === undefined) return;
		const timer = setTimeout(
			() => setNow(performance.now()),
			Math.ceil(wait) + 1,
		);
		onCleanup(() => clearTimeout(timer));
	});

	const tip = () => {
		const index = slot().index;
		return index === undefined ? undefined : props.tips?.[index];
	};

	const shownAtMount = untrack(tip) !== undefined;
	let firstTip = true;
	const entrance = () => {
		const quiet = firstTip;
		firstTip = false;
		return quiet ? undefined : ENTRANCE;
	};

	const tiredAfter = () => props.tiredAfter ?? DEFAULT_TIRED_AFTER;
	const [tired, setTired] = createSignal(
		untrack(() => mountedAt - since() >= tiredAfter()),
	);
	createEffect(() => {
		if (tired()) return;
		const wait = tiredAfter() - (performance.now() - since());
		const timer = setTimeout(() => setTired(true), Math.max(0, wait));
		onCleanup(() => clearTimeout(timer));
	});

	const sink = () => (tired() && !reducedMotionActive() ? TIRED_SINK : 0);

	return (
		<div
			data-loading-screen=""
			role="status"
			aria-label={props.label ?? "Loading"}
			class={cx(
				"relative size-full overflow-hidden bg-background font-sans select-none [container-type:size]",
				props.class,
			)}
		>
			<div
				class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
				style={{ width: `${size()}px`, height: `${size()}px` }}
			>
				<div
					data-loading-bird=""
					data-tired={tired() || undefined}
					class="transition-transform duration-[calc(700ms*var(--motion-scale))] ease-out motion-reduce:transition-none reduced-motion:transition-none"
					style={{
						transform: `translate(${ART_OFFSET_X}%, calc(${ART_OFFSET_Y}% + ${sink()}px))`,
					}}
				>
					<Hummingbird
						size={size()}
						dart
						poke
						bob={tired() ? TIRED_BOB : RESTING_BOB}
					/>
				</div>
			</div>
			<div
				data-loading-tip=""
				aria-live="off"
				class="absolute inset-x-0 flex justify-center px-6 [@container(max-height:479px)]:hidden"
				style={{ top: `calc(50% + ${size() / 2 + TIP_GAP}px)` }}
			>
				<Show when={tip() !== undefined}>
					<div
						class={cx(
							"flex max-w-80 flex-col items-center gap-1 text-center text-sm leading-prose",
							shownAtMount ? undefined : ENTRANCE,
						)}
					>
						<span class="font-semibold text-foreground">Tip</span>
						<Show when={tip()} keyed>
							{(text) => (
								<p
									data-loading-tip-text=""
									class={cx(
										"m-0 text-pretty text-muted-foreground",
										entrance(),
									)}
								>
									{text}
								</p>
							)}
						</Show>
					</div>
				</Show>
			</div>
		</div>
	);
};
