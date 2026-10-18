import {
	ActivityOptInPrompt,
	type ActivityProvider,
	type CardTone,
	toast,
} from "@colibri-social/ui";
import { createSignal } from "solid-js";
import { liveActivitiesOf } from "../../data/activity";
import { readStored, writeStored } from "../../data/persist";
import type { DataSource } from "../../data/source";
import { type DataStore, useData } from "../../data/store";

export const ACTIVITY_PROMPT_TOASTS = {
	enabled: "Others can see what you're listening to now",
	failed: "Couldn't turn on activity sharing",
	failedDescription: "Check your connection and try again.",
} as const;

export const activityPromptKey = (did: string) =>
	`colibri:activity-prompt-dismissed:${did}`;

type PromptState = {
	provider: () => ActivityProvider | null | undefined;
	dismissed: () => boolean;
	setDismissed: (value: boolean) => void;
	justDismissed: () => boolean;
	setJustDismissed: (value: boolean) => void;
	busy: () => boolean;
	setBusy: (value: boolean) => void;
};

const states = new WeakMap<DataSource, Map<string, PromptState>>();

const stateFor = (data: DataStore): PromptState => {
	const did = data.viewer.did;
	let byDid = states.get(data.source);
	if (!byDid) {
		byDid = new Map();
		states.set(data.source, byDid);
	}
	const existing = byDid.get(did);
	if (existing) return existing;
	const [provider, setProvider] = createSignal<ActivityProvider | null>();
	const [dismissed, setDismissedSignal] = createSignal(
		readStored(activityPromptKey(did)) === "1",
	);
	const [justDismissed, setJustDismissed] = createSignal(false);
	const [busy, setBusy] = createSignal(false);
	const detect = data.source.detectActivitySource;
	if (detect && !dismissed()) {
		void detect(did).then((found) => setProvider(found));
	}
	const state: PromptState = {
		provider,
		dismissed,
		setDismissed: (value) => {
			setDismissedSignal(value);
			writeStored(activityPromptKey(did), value ? "1" : undefined);
		},
		justDismissed,
		setJustDismissed,
		busy,
		setBusy,
	};
	byDid.set(did, state);
	return state;
};

export const activityOffer = (data: DataStore, state: PromptState) => {
	if (state.dismissed()) return undefined;
	if (data.preferences.shareActivity()) return undefined;
	const presence = data.presenceOf(data.viewer.did) ?? data.viewer.presence;
	if (liveActivitiesOf(presence).length > 0) return undefined;
	return state.provider() ?? undefined;
};

export const OwnActivityPrompt = (props: { tone?: CardTone }) => {
	const data = useData();
	const state = stateFor(data);
	const enable = async () => {
		state.setBusy(true);
		const ok = await data.preferences.setShareActivity(true);
		state.setBusy(false);
		if (!ok) {
			toast.error(ACTIVITY_PROMPT_TOASTS.failed, {
				description: ACTIVITY_PROMPT_TOASTS.failedDescription,
			});
			return;
		}
		state.setDismissed(true);
		toast.success(ACTIVITY_PROMPT_TOASTS.enabled);
	};
	const dismiss = () => {
		state.setDismissed(true);
		state.setJustDismissed(true);
	};
	return (
		<ActivityOptInPrompt
			provider={activityOffer(data, state)}
			dismissed={state.justDismissed()}
			busy={state.busy()}
			tone={props.tone}
			onEnable={() => void enable()}
			onDismiss={dismiss}
		/>
	);
};
