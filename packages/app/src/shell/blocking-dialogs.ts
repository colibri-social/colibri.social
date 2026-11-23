import { createComputed, createSignal, onCleanup } from "solid-js";

type Entries = readonly symbol[];

const [claims, setClaims] = createSignal<Entries>([]);
const [queue, setQueue] = createSignal<Entries>([]);

const toggle = (update: typeof setClaims, id: symbol, active: boolean) => {
	update((entries) => {
		const present = entries.includes(id);
		if (active === present) return entries;
		return active ? [...entries, id] : entries.filter((entry) => entry !== id);
	});
};

const blockingDialogOpen = () => {
	return claims().length > 0;
};

export const claimBlockingDialog = (open: () => boolean) => {
	const id = Symbol("blocking-dialog");

	createComputed(() => toggle(setClaims, id, open()));
	onCleanup(() => toggle(setClaims, id, false));
};

export const queueBlockingDialog = (wants: () => boolean) => {
	const id = Symbol("queued-dialog");

	createComputed(() => toggle(setQueue, id, wants()));
	onCleanup(() => toggle(setQueue, id, false));

	return () => {
		return wants() && !blockingDialogOpen() && queue()[0] === id;
	};
};
