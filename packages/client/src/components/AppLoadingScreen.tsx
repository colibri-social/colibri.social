import type { Component } from "solid-js";
import {
	type LoadingPhase,
	requestLoadingOverlay,
} from "./hummingbird/loading-overlay-state";

export const AppLoadingScreen: Component<{
	message?: string;
	phase?: LoadingPhase;
	flavor?: boolean;
	delay?: number;
}> = (props) => {
	requestLoadingOverlay({
		message: () => props.message,
		phase: () => props.phase ?? "syncing",
		flavor: () => props.flavor !== false,
		delay: () => props.delay ?? 0,
	});

	return null;
};
