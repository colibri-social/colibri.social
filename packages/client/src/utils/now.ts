import { createSignal, onCleanup } from "solid-js";

// A single shared 1-second clock so every live relative timestamp ticks off one
// interval instead of each spinning up its own. The interval only runs while at
// least one consumer is subscribed.
const [now, setNow] = createSignal(Date.now());

let subscribers = 0;
let timer: ReturnType<typeof setInterval> | undefined;

/**
 * Reactive accessor to a shared clock that updates once per second. Call inside
 * a component/effect; the underlying interval starts on first subscription and
 * stops once the last subscriber is cleaned up.
 */
export const useNow = () => {
	subscribers++;
	if (!timer) {
		setNow(Date.now());
		timer = setInterval(() => setNow(Date.now()), 1000);
	}

	onCleanup(() => {
		subscribers--;
		if (subscribers === 0 && timer) {
			clearInterval(timer);
			timer = undefined;
		}
	});

	return now;
};
