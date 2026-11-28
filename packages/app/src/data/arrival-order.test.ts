import { describe, expect, it } from "vitest";
import { createArrivalOrder, withArrivalOrder } from "./arrival-order";
import type { MessageView, SpaceRef } from "./types";

const channel = "at:space/did:plc:a/channel" as SpaceRef;
const other = "at:space/did:plc:a/other" as SpaceRef;

const message = (rkey: string) => {
	return { rkey } as MessageView;
};

const rkeysOf = (list: readonly MessageView[]) => {
	return list.map((entry) => entry.rkey);
};

describe("arrival order", () => {
	it("keeps rkey order without a confirmed send", () => {
		const arrivals = createArrivalOrder();
		const list = [message("3aaa"), message("3aab")];

		arrivals.arrive(channel, "3aaa");

		expect(arrivals.order(channel, list)).toBe(list);
	});

	it("holds an older arrival below the confirmed send", () => {
		const arrivals = createArrivalOrder();

		arrivals.confirm(channel, "3aac");
		arrivals.arrive(channel, "3aab");

		const ordered = arrivals.order(channel, [
			message("3aaa"),
			message("3aab"),
			message("3aac"),
			message("3aad"),
		]);

		expect(rkeysOf(ordered)).toEqual(["3aaa", "3aac", "3aab", "3aad"]);
	});

	it("keeps held arrivals in arrival order", () => {
		const arrivals = createArrivalOrder();

		arrivals.confirm(channel, "3aac");
		arrivals.arrive(channel, "3aab");
		arrivals.arrive(channel, "3aaa");

		const ordered = arrivals.order(channel, [
			message("3aaa"),
			message("3aab"),
			message("3aac"),
		]);

		expect(rkeysOf(ordered)).toEqual(["3aac", "3aab", "3aaa"]);
	});

	it("leaves newer arrivals and other channels alone", () => {
		const arrivals = createArrivalOrder();
		const list = [message("3aaa"), message("3aab")];

		arrivals.confirm(channel, "3aaa");
		arrivals.arrive(channel, "3aab");
		arrivals.arrive(other, "3aaa");

		expect(arrivals.order(channel, list)).toBe(list);
		expect(arrivals.order(other, list)).toBe(list);
	});

	it("keeps a placement when the anchor moves on", () => {
		const arrivals = createArrivalOrder();

		arrivals.confirm(channel, "3aac");
		arrivals.arrive(channel, "3aab");
		arrivals.confirm(channel, "3aae");
		arrivals.arrive(channel, "3aab");

		const ordered = arrivals.order(channel, [
			message("3aab"),
			message("3aac"),
			message("3aad"),
			message("3aae"),
		]);

		expect(rkeysOf(ordered)).toEqual(["3aac", "3aab", "3aad", "3aae"]);
	});

	it("memoizes on the input list", () => {
		const arrivals = createArrivalOrder();
		const list = [message("3aab"), message("3aac")];

		arrivals.confirm(channel, "3aac");
		arrivals.arrive(channel, "3aab");

		const shown = withArrivalOrder(() => list, arrivals, channel);

		expect(shown()).toBe(shown());
		expect(rkeysOf(shown())).toEqual(["3aac", "3aab"]);
	});
});
