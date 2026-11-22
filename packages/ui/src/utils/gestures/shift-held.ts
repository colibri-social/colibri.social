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

const [typing, setTyping] = createSignal(false);

let typingSubscribers = 0;
let pointerX = Number.NaN;
let pointerY = Number.NaN;

const typesText = (target: EventTarget | null) =>
	target instanceof HTMLElement &&
	(target.isContentEditable ||
		target instanceof HTMLTextAreaElement ||
		target instanceof HTMLInputElement);

const noteKey = (event: KeyboardEvent) => {
	if (typesText(event.target)) setTyping(true);
};

const notePointer = (event: PointerEvent) => {
	const moved = event.clientX !== pointerX || event.clientY !== pointerY;
	pointerX = event.clientX;
	pointerY = event.clientY;
	if (moved || event.type === "pointerdown") setTyping(false);
};

const attachTyping = () => {
	typingSubscribers += 1;
	if (typingSubscribers > 1) return;
	window.addEventListener("keydown", noteKey, true);
	window.addEventListener("pointermove", notePointer, true);
	window.addEventListener("pointerdown", notePointer, true);
};

const detachTyping = () => {
	typingSubscribers -= 1;
	if (typingSubscribers > 0) return;
	window.removeEventListener("keydown", noteKey, true);
	window.removeEventListener("pointermove", notePointer, true);
	window.removeEventListener("pointerdown", notePointer, true);
	setTyping(false);
};

export const useTypingSincePointer = (): (() => boolean) => {
	onMount(attachTyping);
	onCleanup(detachTyping);
	return typing;
};
