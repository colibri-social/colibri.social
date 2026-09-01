import { describe, expect, it } from "vitest";
import { channelPathOf, isThreadPath } from "./thread-presentation";

const CHANNEL = "/app/c/did:plc:x/social.colibri.beta.channel.text/general";

describe("isThreadPath", () => {
	it("recognises a nested thread path", () => {
		expect(isThreadPath(`${CHANNEL}/t/3lthread`)).toBe(true);
		expect(isThreadPath(CHANNEL)).toBe(false);
	});
});

describe("channelPathOf", () => {
	it("strips a trailing thread segment", () => {
		expect(channelPathOf(`${CHANNEL}/t/3lthread`)).toBe(CHANNEL);
	});

	it("leaves a plain channel path alone", () => {
		expect(channelPathOf(CHANNEL)).toBe(CHANNEL);
	});
});
