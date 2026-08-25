import { createSignal } from "solid-js";
import { createLogger } from "../utils/logger";
import { getPreferences, shareActivityOf } from "./notificationPreference";
import { hasActivitySource } from "./teal-source";
import type { ColibriClient } from "./xrpc";

const log = createLogger("activity-suggestion");

export const SOURCE_POLL_MS = 15 * 60 * 1000;

const [sourcePresent, setSourcePresent] = createSignal<boolean | undefined>(
	undefined,
);

const [sharing, setSharing] = createSignal<boolean | undefined>(undefined);

export const activitySourcePresent = sourcePresent;

export const activitySharing = sharing;

export const suggestActivity = (): boolean =>
	sourcePresent() === true && sharing() === false;

export const noteActivitySharing = (value: boolean): void => {
	setSharing(value);
};

export const resetActivitySuggestion = (): void => {
	setSourcePresent(undefined);
	setSharing(undefined);
};

export type ActivitySuggestionDeps = {
	did: string;
	xrpc: ColibriClient;
	dismissed: () => boolean;
};

const readSharing = async (xrpc: ColibriClient): Promise<void> => {
	const res = await getPreferences(xrpc);
	if (!res.ok) {
		log.warn("reading the sharing preference failed", {
			code: res.error.code,
		});
		return;
	}
	setSharing(shareActivityOf(res.data.preferences));
};

const readSource = async (did: string): Promise<void> => {
	setSourcePresent(await hasActivitySource(did));
};

const worthLooking = (deps: ActivitySuggestionDeps): boolean =>
	!deps.dismissed() && sourcePresent() !== true && sharing() !== true;

export const startActivitySuggestion = (
	deps: ActivitySuggestionDeps,
): (() => void) => {
	resetActivitySuggestion();

	void Promise.all([readSharing(deps.xrpc), readSource(deps.did)]);

	const timer = setInterval(() => {
		if (!worthLooking(deps)) return;
		void readSource(deps.did);
	}, SOURCE_POLL_MS);

	return () => clearInterval(timer);
};
