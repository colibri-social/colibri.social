import { describe, expect, it } from "vitest";
import { createLoadSessions } from "./load-session";

type Bookkeeping = { busy: boolean; lastViewAt: number };

const sessions = () =>
	createLoadSessions<Bookkeeping>(() => ({ busy: false, lastViewAt: 0 }));

describe("createLoadSessions", () => {
	it("hands out increasing generations and a live signal", () => {
		const loads = sessions();

		const first = loads.begin("at://a");
		const second = loads.begin("at://b");

		expect(first.generation).toBe(1);
		expect(second.generation).toBe(2);
		expect(first.key).toBe("at://a");
		expect(second.key).toBe("at://b");
		expect(second.supersededSignal.aborted).toBe(false);
	});

	it("aborts the previous session without touching teardown", () => {
		const loads = sessions();

		const first = loads.begin("at://a");
		const second = loads.begin("at://b");

		expect(first.supersededSignal.aborted).toBe(true);
		expect(second.supersededSignal.aborted).toBe(false);
		expect(loads.teardownSignal.aborted).toBe(false);
	});

	it("treats the first visit as superseded across an A, B, A switch", () => {
		const loads = sessions();

		const firstA = loads.begin("at://a");
		loads.begin("at://b");
		const secondA = loads.begin("at://a");

		expect(firstA.key).toBe(secondA.key);
		expect(loads.isCurrent(firstA)).toBe(false);
		expect(loads.isCurrent(secondA)).toBe(true);
	});

	it("gives each session its own bookkeeping", () => {
		const loads = sessions();

		const first = loads.begin("at://a");
		first.state.busy = true;
		first.state.lastViewAt = 1234;

		const second = loads.begin("at://b");

		expect(second.state.busy).toBe(false);
		expect(second.state.lastViewAt).toBe(0);

		first.state.busy = false;
		second.state.busy = true;

		expect(loads.current()?.state.busy).toBe(true);
	});

	it("exposes the newest session through current", () => {
		const loads = sessions();

		loads.begin("at://a");
		const second = loads.begin("at://b");

		expect(loads.current()).toBe(second);
	});

	it("makes every session stale once the current one is aborted", () => {
		const loads = sessions();

		const first = loads.begin("at://a");
		const second = loads.begin("at://b");
		loads.abortCurrent();

		expect(second.supersededSignal.aborted).toBe(true);
		expect(loads.current()).toBeUndefined();
		expect(loads.isCurrent(first)).toBe(false);
		expect(loads.isCurrent(second)).toBe(false);
		expect(loads.teardownSignal.aborted).toBe(false);
	});

	it("aborts both signals on dispose", () => {
		const loads = sessions();

		const only = loads.begin("at://a");
		loads.dispose();

		expect(only.supersededSignal.aborted).toBe(true);
		expect(loads.teardownSignal.aborted).toBe(true);
	});

	it("tolerates repeated aborts and a begin with no predecessor", () => {
		const loads = sessions();

		expect(() => {
			loads.abortCurrent();
			loads.abortCurrent();
		}).not.toThrow();

		const fresh = loads.begin("at://a");
		expect(fresh.supersededSignal.aborted).toBe(false);

		expect(() => {
			loads.dispose();
			loads.dispose();
		}).not.toThrow();
	});
});
