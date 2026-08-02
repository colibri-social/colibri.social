import { useLocation } from "@solidjs/router";
import { type Accessor, createEffect, createSignal } from "solid-js";
import { applyNavEntry } from "./nav-stack";

const [canGoBack, setCanGoBack] = createSignal(false);
const [canGoForward, setCanGoForward] = createSignal(false);

export const navCanGoBack: Accessor<boolean> = canGoBack;
export const navCanGoForward: Accessor<boolean> = canGoForward;

export const goBack = (): void => {
	if (canGoBack()) history.back();
};

export const goForward = (): void => {
	if (canGoForward()) history.forward();
};

export const trackNavHistory = (): void => {
	const location = useLocation();

	let stack: Array<string> = [];
	let index = -1;
	let lastLength = 0;

	createEffect(() => {
		const entry = `${location.pathname}${location.search}`;

		if (index === -1) {
			stack = [entry];
			index = 0;
			lastLength = history.length;
			setCanGoBack(false);
			setCanGoForward(false);
			return;
		}

		if (entry === stack[index]) return;

		const pushed = history.length > lastLength;
		lastLength = history.length;

		const next = applyNavEntry(stack, index, entry, pushed);
		stack = next.stack;
		index = next.index;

		setCanGoBack(index > 0);
		setCanGoForward(index < stack.length - 1);
	});
};
