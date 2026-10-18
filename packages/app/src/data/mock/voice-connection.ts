import { createSignal } from "solid-js";
import {
	DISCONNECTED,
	qualityFor,
	type VoiceConnection,
	type VoiceConnectionMonitor,
} from "../voice/types";

export type { VoiceConnection, VoiceConnectionMonitor } from "../voice/types";
export { DISCONNECTED, qualityFor } from "../voice/types";

export type SimulatedConnectionOptions = {
	random?: () => number;
	connectMs?: number;
	tickMs?: number;
	baseline?: number;
};

export const driftLatency = (
	current: number,
	baseline: number,
	random: () => number,
) => {
	const pull = (baseline - current) * 0.25;
	const noise = (random() - 0.5) * 24;
	const spike = random() < 0.04 ? 140 + random() * 160 : 0;
	return Math.max(8, Math.round(current + pull + noise + spike));
};

export const createSimulatedConnection = (
	options: SimulatedConnectionOptions = {},
): VoiceConnectionMonitor => {
	const random = options.random ?? Math.random;
	const baseline = options.baseline ?? 52;
	const [connection, setConnection] =
		createSignal<VoiceConnection>(DISCONNECTED);
	let connectTimer: ReturnType<typeof setTimeout> | undefined;
	let tickTimer: ReturnType<typeof setInterval> | undefined;

	const stop = () => {
		clearTimeout(connectTimer);
		clearInterval(tickTimer);
		connectTimer = undefined;
		tickTimer = undefined;
		setConnection(DISCONNECTED);
	};

	const measure = (latency: number) =>
		setConnection({
			state: "connected",
			quality: qualityFor(latency),
			latency,
		});

	const start = () => {
		stop();
		setConnection({ state: "connecting", quality: "unknown", latency: null });
		connectTimer = setTimeout(() => {
			let latency = Math.round(baseline + (random() - 0.5) * 20);
			measure(latency);
			tickTimer = setInterval(() => {
				latency = driftLatency(latency, baseline, random);
				measure(latency);
			}, options.tickMs ?? 2_000);
		}, options.connectMs ?? 700);
	};

	return { connection, start, stop };
};
