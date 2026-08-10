import { describe, expect, it } from "vitest";
import {
	buildChannelPath,
	parseChannelPath,
	parseColibriChannelUrl,
} from "./colibri-channel-url";

const DID = "did:plc:abc123";
const COMMUNITY = `at://${DID}/social.colibri.community/self`;
const CHANNEL = `at://${DID}/social.colibri.channel/general`;

describe("parseChannelPath", () => {
	it("parses a short-form text path", () => {
		expect(parseChannelPath(`/app/c/${DID}/text/general`)).toEqual({
			communitySegment: DID,
			communityUri: COMMUNITY,
			channelType: "text",
			channelRkey: "general",
			channelUri: CHANNEL,
		});
	});

	it("accepts the full NSID form of the channel type", () => {
		expect(
			parseChannelPath(`/app/c/${DID}/social.colibri.channel.text/general`)
				?.channelUri,
		).toBe(CHANNEL);
	});

	it("accepts voice channels, unlike the prefetch helper", () => {
		expect(parseChannelPath(`/app/c/${DID}/voice/lounge`)?.channelType).toBe(
			"voice",
		);
	});

	it("keeps a non-self community rkey in the community URI", () => {
		const target = parseChannelPath(`/app/c/${DID}-myrkey/text/general`);
		expect(target?.communityUri).toBe(
			`at://${DID}/social.colibri.community/myrkey`,
		);
		expect(target?.channelUri).toBe(CHANNEL);
	});

	it("decodes a percent-encoded rkey", () => {
		expect(parseChannelPath(`/app/c/${DID}/text/off%20topic`)?.channelUri).toBe(
			`at://${DID}/social.colibri.channel/off topic`,
		);
	});

	it("tolerates trailing segments", () => {
		expect(
			parseChannelPath(`/app/c/${DID}/text/general/extra`)?.channelUri,
		).toBe(CHANNEL);
	});

	it("rejects an unknown channel type", () => {
		expect(parseChannelPath(`/app/c/${DID}/whiteboard/x`)).toBeNull();
	});

	it("rejects paths that are not channel deep links", () => {
		expect(parseChannelPath("/app")).toBeNull();
		expect(parseChannelPath(`/app/c/${DID}`)).toBeNull();
		expect(parseChannelPath(`/app/c/${DID}/text`)).toBeNull();
		expect(parseChannelPath("/app/login")).toBeNull();
		expect(parseChannelPath("/invite/abc")).toBeNull();
	});

	it("rejects a community segment that is not a DID", () => {
		expect(parseChannelPath("/app/c/notadid/text/general")).toBeNull();
	});
});

describe("parseColibriChannelUrl", () => {
	it("accepts both public hosts", () => {
		expect(
			parseColibriChannelUrl(`https://colibri.social/app/c/${DID}/text/general`)
				?.channelUri,
		).toBe(CHANNEL);
		expect(
			parseColibriChannelUrl(
				`https://next.colibri.social/app/c/${DID}/text/general`,
			)?.channelUri,
		).toBe(CHANNEL);
	});

	it("ignores a query string and hash", () => {
		expect(
			parseColibriChannelUrl(
				`https://colibri.social/app/c/${DID}/text/general?a=1#b`,
			)?.channelUri,
		).toBe(CHANNEL);
	});

	it("trims surrounding whitespace", () => {
		expect(
			parseColibriChannelUrl(
				`  https://colibri.social/app/c/${DID}/text/general  `,
			)?.channelUri,
		).toBe(CHANNEL);
	});

	it("accepts the native deep-link scheme", () => {
		expect(
			parseColibriChannelUrl(`social.colibri:/channel/${DID}/text/general`)
				?.channelUri,
		).toBe(CHANNEL);
	});

	it("rejects a foreign host", () => {
		expect(
			parseColibriChannelUrl(`https://example.com/app/c/${DID}/text/general`),
		).toBeNull();
	});

	it("rejects an invite link", () => {
		expect(
			parseColibriChannelUrl("https://colibri.social/invite/abc"),
		).toBeNull();
	});

	it("rejects a non-URL string", () => {
		expect(parseColibriChannelUrl("general")).toBeNull();
		expect(parseColibriChannelUrl("")).toBeNull();
	});
});

describe("buildChannelPath", () => {
	it("round-trips through the parser", () => {
		const path = buildChannelPath({
			communityUri: COMMUNITY,
			channelType: "social.colibri.channel.text",
			channelRkey: "general",
		});
		expect(path).toBe(`/app/c/${DID}/social.colibri.channel.text/general`);
		expect(parseChannelPath(path)?.channelUri).toBe(CHANNEL);
	});

	it("round-trips a non-self community and an encoded rkey", () => {
		const path = buildChannelPath({
			communityUri: `at://${DID}/social.colibri.community/myrkey`,
			channelType: "voice",
			channelRkey: "off topic",
		});
		const target = parseChannelPath(path);
		expect(target?.communityUri).toBe(
			`at://${DID}/social.colibri.community/myrkey`,
		);
		expect(target?.channelRkey).toBe("off topic");
	});
});
