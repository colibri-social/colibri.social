import { createMemo, createRoot } from "solid-js";
import { describe, expect, it } from "vitest";
import {
	type Activity,
	createActivityClock,
	memberActivityOf,
} from "./activity";
import type { Presence } from "./types";

const until = async (check: () => boolean, timeout = 3000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

const activity = (
	kind: string,
	title: string,
	startedAt: number,
	endsAt: number,
) =>
	({
		kind,
		title,
		source: "steam",
		startedAt: new Date(startedAt).toISOString(),
		endsAt: new Date(endsAt).toISOString(),
	}) as Activity;

describe("activity expiry", () => {
	it("clears the activity line once it ends without a presence update", async () => {
		const start = Date.now();
		const presence = {
			onlineState: "online",
			activities: [
				activity("playing", "Celeste", start - 1000, start + 150),
				activity("listening", "Manual Drive", start - 2000, start + 400),
			],
		} as Presence;
		const now = createActivityClock();
		const line = createRoot((dispose) => ({
			dispose,
			read: createMemo(() => memberActivityOf(presence, now(presence))),
		}));
		expect(line.read()).toEqual({
			kind: "playing",
			summary: "Celeste",
			more: 1,
		});
		await until(() => line.read()?.kind === "listening");
		expect(line.read()?.more).toBe(0);
		await until(() => line.read() === undefined);
		line.dispose();
	});
});
