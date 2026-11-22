import { createSignal, getOwner, onCleanup } from "solid-js";

const [now, setNow] = createSignal(Date.now());

let subscribers = 0;
let timer: ReturnType<typeof setInterval> | undefined;

export const useNow = () => {
	if (!getOwner()) return now;
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
