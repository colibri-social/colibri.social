import { createRoot, createSignal } from "solid-js";
import { describe, expect, it } from "vitest";
import type { LiveStatus } from "./remote/live";
import { installResumeSync, type ResumeEnvironment } from "./resume";

const fakeEnvironment = () => {
	const document = new EventTarget();
	const window = new EventTarget();
	let visible = true;
	let now = 0;
	const environment: ResumeEnvironment = {
		document,
		window,
		visible: () => visible,
		now: () => now,
	};
	return {
		environment,
		hide: () => {
			visible = false;
			document.dispatchEvent(new Event("visibilitychange"));
		},
		show: () => {
			visible = true;
			document.dispatchEvent(new Event("visibilitychange"));
		},
		pageshow: () => window.dispatchEvent(new Event("pageshow")),
		pagehide: () => window.dispatchEvent(new Event("pagehide")),
		advance: (ms: number) => {
			now += ms;
		},
	};
};

describe("installResumeSync", () => {
	it("catches up on resume and after the live connection comes back", () => {
		const fake = fakeEnvironment();
		const calls: string[] = [];
		const [status, setStatus] = createSignal<LiveStatus>("connecting");
		const stop = createRoot(() =>
			installResumeSync(
				{
					catchUp: () => calls.push("catchUp"),
					pauseCatchUp: () => calls.push("pause"),
				},
				{ status },
				fake.environment,
			),
		);
		setStatus("open");
		expect(calls).toEqual([]);
		fake.hide();
		fake.advance(10_000);
		fake.show();
		expect(calls).toEqual(["pause", "catchUp"]);
		setStatus("reconnecting");
		setStatus("open");
		expect(calls).toEqual(["pause", "catchUp", "catchUp"]);
		stop();
		setStatus("reconnecting");
		setStatus("open");
		expect(calls).toHaveLength(3);
	});
});
