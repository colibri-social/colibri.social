import { describe, expect, it } from "vitest";
import { decideChannelExit } from "./channel-exit";

describe("decideChannelExit", () => {
	it("stays put when no channel is routed to", () => {
		expect(decideChannelExit(true, "", false)).toBe("stay");
	});

	it("stays put while the channel is in the payload", () => {
		expect(decideChannelExit(true, "3lkabc", true)).toBe("stay");
	});

	it("waits for the server payload before giving up on a channel", () => {
		expect(decideChannelExit(false, "3lkabc", false)).toBe("stay");
	});

	it("leaves once the server payload has no such channel", () => {
		expect(decideChannelExit(true, "3lkabc", false)).toBe("leave");
	});
});
