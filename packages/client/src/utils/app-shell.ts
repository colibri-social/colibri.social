import { createSignal, onCleanup, onMount } from "solid-js";

const [mounted, setMounted] = createSignal(false);

export const appShellMounted = mounted;

export const trackAppShellMounted = (): void => {
	onMount(() => setMounted(true));
	onCleanup(() => setMounted(false));
};
