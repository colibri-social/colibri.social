import { createSignal, onCleanup, onMount } from "solid-js";

const [shiftHeld, setShiftHeld] = createSignal(false);

let subscribers = 0;

const sync = (event: KeyboardEvent) => setShiftHeld(event.shiftKey);

const release = () => setShiftHeld(false);

const attach = () => {
	subscribers += 1;
	if (subscribers > 1) return;
	window.addEventListener("keydown", sync);
	window.addEventListener("keyup", sync);
	window.addEventListener("blur", release);
};

const detach = () => {
	subscribers -= 1;
	if (subscribers > 0) return;
	window.removeEventListener("keydown", sync);
	window.removeEventListener("keyup", sync);
	window.removeEventListener("blur", release);
	setShiftHeld(false);
};

export const useShiftHeld = (): (() => boolean) => {
	onMount(attach);
	onCleanup(detach);
	return shiftHeld;
};
