import { type Accessor, createSignal, onCleanup } from "solid-js";

export type LoadingPhase = "connecting" | "syncing";

export interface LoadingRequest {
	message: Accessor<string | undefined>;
	phase: Accessor<LoadingPhase>;
	flavor: Accessor<boolean>;
}

const [requests, setRequests] = createSignal<Array<LoadingRequest>>([]);

export const loadingRequests = requests;

export const activeLoadingRequest = (): LoadingRequest | undefined =>
	requests().at(-1);

export const requestLoadingOverlay = (request: LoadingRequest): void => {
	setRequests((current) => [...current, request]);
	onCleanup(() =>
		setRequests((current) => current.filter((entry) => entry !== request)),
	);
};
