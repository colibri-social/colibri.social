import { createSignal } from "solid-js";

const [count, setCount] = createSignal(0);

export const blockingDialogCount = count;

export const claimBlockingDialog = (): (() => void) => {
	setCount((value) => value + 1);
	let released = false;

	return () => {
		if (released) return;
		released = true;
		setCount((value) => Math.max(0, value - 1));
	};
};
