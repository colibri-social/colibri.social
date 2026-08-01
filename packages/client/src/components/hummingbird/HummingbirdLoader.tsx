import {
	type Component,
	createEffect,
	createMemo,
	createSignal,
	onCleanup,
	Show,
} from "solid-js";
import { Hummingbird } from "./Hummingbird";
import type { LoadingPhase } from "./loading-overlay-state";
import { DEFAULT_LINE, FLAVOR_LINES, TIRED_LINES } from "./messages";

const CONNECTING_TEMPO = 1.6;
const SYNCING_TEMPO = 0.95;
const RESTING_BOB = 1.75;
const TIRED_BOB = 2.8;
const ROTATE_INTERVAL = 2500;

export const LABEL_FADE = 140;
export const DART_DURATION = 220;

export interface HummingbirdLoaderProps {
	size?: number;
	phase?: LoadingPhase;
	message?: string;
	flavor?: boolean;
	tired?: boolean;
	exiting?: boolean;
}

export const HummingbirdLoader: Component<HummingbirdLoaderProps> = (props) => {
	const [index, setIndex] = createSignal(0);

	const lines = createMemo(() => {
		const head = props.message ?? DEFAULT_LINE;
		if (props.flavor === false) return [head];
		return props.tired ? [head, ...TIRED_LINES] : [head, ...FLAVOR_LINES];
	});

	createEffect(() => {
		const pool = lines();
		setIndex(0);
		if (pool.length < 2) return;

		const timer = setInterval(
			() => setIndex((current) => (current + 1) % pool.length),
			ROTATE_INTERVAL,
		);
		onCleanup(() => clearInterval(timer));
	});

	const line = () => lines()[index() % lines().length];

	return (
		<div class="flex flex-col items-center gap-3.5">
			<div
				class="transition-transform delay-[140ms] duration-[220ms] ease-in motion-reduce:transition-none"
				classList={{ "translate-x-[120vw] -translate-y-[30vh]": props.exiting }}
			>
				<div
					class="transition-transform duration-700 ease-out motion-reduce:transition-none"
					classList={{ "translate-y-1.5": props.tired }}
				>
					<Hummingbird
						size={props.size}
						dart
						poke
						frozen={props.exiting}
						tempo={
							props.phase === "connecting" ? CONNECTING_TEMPO : SYNCING_TEMPO
						}
						bob={props.tired ? TIRED_BOB : RESTING_BOB}
					/>
				</div>
			</div>

			<div
				class="transition-opacity duration-[140ms] motion-reduce:transition-none"
				classList={{ "opacity-0": props.exiting }}
			>
				<Show when={line()} keyed>
					{(current) => (
						<p
							class="animate-in fade-in-0 m-0 text-center text-muted-foreground text-sm duration-500 motion-reduce:animate-none"
							aria-live="polite"
						>
							{current}
						</p>
					)}
				</Show>
			</div>
		</div>
	);
};
