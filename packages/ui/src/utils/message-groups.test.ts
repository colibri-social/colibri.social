import { describe, expect, it } from "vitest";
import { groupMessages } from "./message-groups";

const BRIDGE = "did:plc:matrixbridge";

const at = (minutes: number) => new Date(2026, 9, 18, 9, minutes);

const continuations = (
	messages: { author: string; groupKey?: string; timestamp: Date }[],
) =>
	groupMessages(messages).map((entry) => [
		entry.continuation,
		entry.hasContinuation,
	]);

describe("groupMessages", () => {
	it("joins messages from the same author", () => {
		expect(
			continuations([
				{ author: "did:plc:lou", timestamp: at(0) },
				{ author: "did:plc:lou", timestamp: at(1) },
			]),
		).toEqual([
			[false, true],
			[true, false],
		]);
	});

	it("splits bridged people who share one bridge account", () => {
		expect(
			continuations([
				{
					author: BRIDGE,
					groupKey: `${BRIDGE} reg @max:matrix.org`,
					timestamp: at(0),
				},
				{
					author: BRIDGE,
					groupKey: `${BRIDGE} reg @june:matrix.org`,
					timestamp: at(1),
				},
				{
					author: BRIDGE,
					groupKey: `${BRIDGE} reg @june:matrix.org`,
					timestamp: at(2),
				},
			]),
		).toEqual([
			[false, false],
			[false, true],
			[true, false],
		]);
	});

	it("falls back to the author when a message has no group key", () => {
		expect(
			continuations([
				{ author: "did:plc:lou", groupKey: "did:plc:lou", timestamp: at(0) },
				{ author: "did:plc:lou", timestamp: at(1) },
			]),
		).toEqual([
			[false, true],
			[true, false],
		]);
	});
});
