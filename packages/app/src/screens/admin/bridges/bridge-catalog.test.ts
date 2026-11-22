import { describe, expect, it } from "vitest";
import { platformName } from "./bridge-catalog";

describe("platformName", () => {
	it("uses the display name of known platforms", () => {
		expect(platformName("irc")).toBe("IRC");
		expect(platformName("matrix")).toBe("Matrix");
		expect(platformName("slack")).toBe("Slack");
		expect(platformName("telegram")).toBe("Telegram");
		expect(platformName("xmpp")).toBe("XMPP");
		expect(platformName("XMPP")).toBe("XMPP");
	});

	it("capitalises unknown platforms", () => {
		expect(platformName("zulip")).toBe("Zulip");
		expect(platformName("")).toBe("another service");
	});
});
