import { type Accessor, createEffect, createSignal, onCleanup } from "solid-js";

const [stale, setStale] = createSignal(false);

export const communityRefreshStale = stale;

export const trackCommunityRefresh = (failed: Accessor<boolean>): void => {
	createEffect(() => setStale(failed()));
	onCleanup(() => setStale(false));
};
