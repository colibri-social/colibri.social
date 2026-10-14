import { createRoot } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	createSimulatedConnection,
	driftLatency,
	qualityFor,
} from "./voice-connection";

afterEach(() => vi.useRealTimers());

describe("simulated voice connection", () => {
	it("maps latency to the client quality thresholds", () => {
		expect(qualityFor(40)).toBe("excellent");
		expect(qualityFor(149)).toBe("excellent");
		expect(qualityFor(150)).toBe("good");
		expect(qualityFor(299)).toBe("good");
		expect(qualityFor(300)).toBe("poor");
	});

	it("drifts back toward the baseline without spikes", () => {
		let latency = 260;
		for (let step = 0; step < 20; step++) {
			latency = driftLatency(latency, 50, () => 0.5);
		}
		expect(latency).toBeGreaterThan(45);
		expect(latency).toBeLessThan(60);
	});

	it("spikes rarely and stays positive", () => {
		const spiked = driftLatency(50, 50, () => 0.01);
		expect(spiked).toBeGreaterThan(150);
		expect(driftLatency(10, 10, () => 0)).toBeGreaterThanOrEqual(8);
	});

	it("connects, measures, drifts and stops", () => {
		vi.useFakeTimers();
		createRoot((dispose) => {
			const monitor = createSimulatedConnection({
				random: () => 0.5,
				connectMs: 500,
				tickMs: 1000,
			});
			expect(monitor.connection().state).toBe("disconnected");
			monitor.start();
			expect(monitor.connection()).toEqual({
				state: "connecting",
				quality: "unknown",
				latency: null,
			});
			vi.advanceTimersByTime(500);
			expect(monitor.connection()).toEqual({
				state: "connected",
				quality: "excellent",
				latency: 52,
			});
			vi.advanceTimersByTime(3000);
			expect(monitor.connection().state).toBe("connected");
			monitor.stop();
			expect(monitor.connection().state).toBe("disconnected");
			vi.advanceTimersByTime(3000);
			expect(monitor.connection().state).toBe("disconnected");
			dispose();
		});
	});
});
