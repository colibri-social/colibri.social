import { describe, expect, it } from "vitest";
import {
	channelSpaceCandidates,
	channelSpaceRef,
	channelSpaceType,
	isChannelSpace,
	isThreadSpace,
	parseSpace,
	spaceAuthority,
	spaceSkey,
	threadSpaceRef,
} from "./space-ref";

const DID = "did:plc:abc123";
const TEXT = `at://${DID}/space/social.colibri.beta.channel.text/general`;
const VOICE = `at://${DID}/space/social.colibri.beta.channel.voice/lounge`;
const MEMBERS = `at://${DID}/space/social.colibri.beta.community.members/self`;
const THREAD = `at://${DID}/space/social.colibri.beta.channel.thread/3lthread`;

describe("parseSpace", () => {
	it("splits a space ref into its three parts", () => {
		expect(parseSpace(TEXT)).toEqual({
			authority: DID,
			type: "social.colibri.beta.channel.text",
			skey: "general",
		});
	});

	it("rejects anything that is not a space ref", () => {
		expect(
			parseSpace(`at://${DID}/social.colibri.beta.message/3l`),
		).toBeUndefined();
		expect(parseSpace(`at://${DID}/space/only.two.parts`)).toBeUndefined();
		expect(parseSpace(`${DID}/space/a.b.c/self`)).toBeUndefined();
		expect(parseSpace("")).toBeUndefined();
	});

	it("rejects a ref with trailing segments, so a record uri is never read as a space", () => {
		expect(parseSpace(`${TEXT}/3lextra`)).toBeUndefined();
	});

	it("rejects an empty part", () => {
		expect(parseSpace("at:///space/a.b.c/self")).toBeUndefined();
		expect(parseSpace(`at://${DID}/space//self`)).toBeUndefined();
		expect(parseSpace(`at://${DID}/space/a.b.c/`)).toBeUndefined();
	});
});

describe("spaceAuthority and spaceSkey", () => {
	it("read the two identifying parts", () => {
		expect(spaceAuthority(TEXT)).toBe(DID);
		expect(spaceSkey(TEXT)).toBe("general");
		expect(spaceSkey(MEMBERS)).toBe("self");
	});

	it("return undefined for a non-space", () => {
		expect(spaceAuthority("nonsense")).toBeUndefined();
		expect(spaceSkey("nonsense")).toBeUndefined();
	});
});

describe("isChannelSpace", () => {
	it("accepts only the two channel space types", () => {
		expect(isChannelSpace(TEXT)).toBe(true);
		expect(isChannelSpace(VOICE)).toBe(true);
		expect(isChannelSpace(MEMBERS)).toBe(false);
		expect(isChannelSpace("nonsense")).toBe(false);
	});
});

describe("channelSpaceType", () => {
	it("accepts the short url form", () => {
		expect(channelSpaceType("text")).toBe("social.colibri.beta.channel.text");
		expect(channelSpaceType("voice")).toBe("social.colibri.beta.channel.voice");
	});

	it("passes a full channel space type through", () => {
		expect(channelSpaceType("social.colibri.beta.channel.text")).toBe(
			"social.colibri.beta.channel.text",
		);
	});

	it("rejects a non-channel space type and an unknown word", () => {
		expect(
			channelSpaceType("social.colibri.beta.community.members"),
		).toBeUndefined();
		expect(channelSpaceType("forum")).toBeUndefined();
	});
});

describe("channelSpaceRef", () => {
	it("builds a ref from either type form", () => {
		expect(channelSpaceRef(DID, "text", "general")).toBe(TEXT);
		expect(
			channelSpaceRef(DID, "social.colibri.beta.channel.voice", "lounge"),
		).toBe(VOICE);
	});

	it("refuses to build a ref for a type that is not a channel", () => {
		expect(channelSpaceRef(DID, "forum", "general")).toBeUndefined();
	});

	it("round-trips through parseSpace", () => {
		const ref = channelSpaceRef(DID, "text", "off topic") as string;
		expect(parseSpace(ref)).toEqual({
			authority: DID,
			type: "social.colibri.beta.channel.text",
			skey: "off topic",
		});
	});
});

describe("channelSpaceCandidates", () => {
	it("offers both channel space types for a skey of unknown type", () => {
		expect(channelSpaceCandidates(DID, "general")).toEqual([
			TEXT,
			`at://${DID}/space/social.colibri.beta.channel.voice/general`,
		]);
	});
});

describe("isThreadSpace", () => {
	it("recognises a thread space", () => {
		expect(isThreadSpace(THREAD)).toBe(true);
	});

	it("does not treat a channel or a community space as a thread", () => {
		expect(isThreadSpace(TEXT)).toBe(false);
		expect(isThreadSpace(VOICE)).toBe(false);
		expect(isThreadSpace(MEMBERS)).toBe(false);
	});
});

describe("isChannelSpace", () => {
	it("keeps a thread out, so nothing channel-shaped picks one up", () => {
		expect(isChannelSpace(THREAD)).toBe(false);
	});
});

describe("threadSpaceRef", () => {
	it("builds a thread space from a community and a key", () => {
		expect(threadSpaceRef(DID, "3lthread")).toBe(THREAD);
	});

	it("returns nothing without both parts", () => {
		expect(threadSpaceRef("", "3lthread")).toBeUndefined();
		expect(threadSpaceRef(DID, "")).toBeUndefined();
	});
});
