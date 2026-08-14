import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	ackMarkRead,
	listenForPendingMarkRead,
	PENDING_MARK_READ_EVENT,
	readPendingMarkRead,
} from "./mark-read-queue";

const pendingMarkRead = vi.fn();
const ack = vi.fn();

const stubBridge = () => {
	vi.stubGlobal("window", {
		__colibriNotificationActions: {
			pendingMarkRead: () => pendingMarkRead(),
			ackMarkRead: (channelUri: string) => ack(channelUri),
		},
	});
};

beforeEach(() => {
	stubBridge();
	pendingMarkRead.mockReturnValue("[]");
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

describe("readPendingMarkRead", () => {
	it("returns the queued entries the native side handed over", () => {
		pendingMarkRead.mockReturnValue(
			JSON.stringify([
				{
					channelUri: "at://did:plc:one/social.colibri.channel/abc",
					messageUri: "at://did:plc:two/social.colibri.message/def",
					actionedAt: 1_700_000_000_000,
				},
			]),
		);

		expect(readPendingMarkRead()).toEqual([
			{
				channelUri: "at://did:plc:one/social.colibri.channel/abc",
				messageUri: "at://did:plc:two/social.colibri.message/def",
				actionedAt: 1_700_000_000_000,
			},
		]);
	});

	it("keeps an entry that never carried a message uri", () => {
		pendingMarkRead.mockReturnValue(
			JSON.stringify([{ channelUri: "at://one", actionedAt: 1 }]),
		);

		expect(readPendingMarkRead()).toEqual([
			{ channelUri: "at://one", actionedAt: 1 },
		]);
	});

	it("reports an empty queue where the bridge does not exist", () => {
		vi.stubGlobal("window", {});

		expect(readPendingMarkRead()).toEqual([]);
	});

	it("settles instead of throwing when the bridge returns junk", () => {
		pendingMarkRead.mockReturnValue("not json");

		expect(readPendingMarkRead()).toEqual([]);
	});

	it("drops entries that are missing the fields the drain needs", () => {
		pendingMarkRead.mockReturnValue(
			JSON.stringify([
				{ channelUri: "at://one", actionedAt: 1 },
				{ channelUri: "at://two" },
				{ actionedAt: 2 },
				null,
			]),
		);

		expect(readPendingMarkRead()).toEqual([
			{ channelUri: "at://one", actionedAt: 1 },
		]);
	});
});

describe("ackMarkRead", () => {
	it("hands the channel back to the native queue", () => {
		ackMarkRead("at://one");

		expect(ack).toHaveBeenCalledWith("at://one");
	});

	it("stays quiet where the bridge does not exist", () => {
		vi.stubGlobal("window", {});

		expect(() => ackMarkRead("at://one")).not.toThrow();
	});
});

describe("listenForPendingMarkRead", () => {
	it("runs the handler when the activity announces pending work", () => {
		const addEventListener = vi.fn();
		const removeEventListener = vi.fn();
		vi.stubGlobal("window", { addEventListener, removeEventListener });

		const handler = vi.fn();
		const stop = listenForPendingMarkRead(handler);

		expect(addEventListener).toHaveBeenCalledWith(
			PENDING_MARK_READ_EVENT,
			handler,
		);

		stop();

		expect(removeEventListener).toHaveBeenCalledWith(
			PENDING_MARK_READ_EVENT,
			handler,
		);
	});
});
