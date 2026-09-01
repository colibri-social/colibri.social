import { describe, expect, it } from "vitest";
import {
	buildChannelPath,
	buildSpacePath,
	buildThreadPath,
	forgetThreadParent,
	parseChannelPath,
	parseColibriChannelUrl,
	parseThreadPath,
	rememberThreadParent,
} from "./colibri-channel-url";

const DID = "did:plc:abc123";
const TEXT_SPACE = `at://${DID}/space/social.colibri.beta.channel.text/general`;
const VOICE_SPACE = `at://${DID}/space/social.colibri.beta.channel.voice/lounge`;
const THREAD_SPACE = `at://${DID}/space/social.colibri.beta.channel.thread/3lthread`;
const CHANNEL_PATH = `/app/c/${DID}/social.colibri.beta.channel.text/general`;

describe("parseChannelPath", () => {
	it("parses a short-form text path", () => {
		expect(parseChannelPath(`/app/c/${DID}/text/general`)).toEqual({
			community: DID,
			channelType: "text",
			channelSkey: "general",
			channelSpace: TEXT_SPACE,
		});
	});

	it("accepts the full space type of the channel", () => {
		expect(
			parseChannelPath(`/app/c/${DID}/social.colibri.beta.channel.text/general`)
				?.channelSpace,
		).toBe(TEXT_SPACE);
	});

	it("accepts voice channels", () => {
		expect(parseChannelPath(`/app/c/${DID}/voice/lounge`)?.channelSpace).toBe(
			VOICE_SPACE,
		);
	});

	it("decodes a percent-encoded skey", () => {
		expect(
			parseChannelPath(`/app/c/${DID}/text/off%20topic`)?.channelSpace,
		).toBe(`at://${DID}/space/social.colibri.beta.channel.text/off topic`);
	});

	it("tolerates trailing segments", () => {
		expect(
			parseChannelPath(`/app/c/${DID}/text/general/extra`)?.channelSpace,
		).toBe(TEXT_SPACE);
	});

	it("rejects an unknown channel type", () => {
		expect(parseChannelPath(`/app/c/${DID}/whiteboard/x`)).toBeNull();
	});

	it("rejects a non-channel space type", () => {
		expect(
			parseChannelPath(
				`/app/c/${DID}/social.colibri.beta.community.members/self`,
			),
		).toBeNull();
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
				?.channelSpace,
		).toBe(TEXT_SPACE);
		expect(
			parseColibriChannelUrl(
				`https://next.colibri.social/app/c/${DID}/text/general`,
			)?.channelSpace,
		).toBe(TEXT_SPACE);
	});

	it("ignores a query string and hash", () => {
		expect(
			parseColibriChannelUrl(
				`https://colibri.social/app/c/${DID}/text/general?a=1#b`,
			)?.channelSpace,
		).toBe(TEXT_SPACE);
	});

	it("trims surrounding whitespace", () => {
		expect(
			parseColibriChannelUrl(
				`  https://colibri.social/app/c/${DID}/text/general  `,
			)?.channelSpace,
		).toBe(TEXT_SPACE);
	});

	it("accepts the native deep-link scheme", () => {
		expect(
			parseColibriChannelUrl(`social.colibri:/channel/${DID}/text/general`)
				?.channelSpace,
		).toBe(TEXT_SPACE);
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
	it("names the channel by its full space type", () => {
		const path = buildChannelPath(TEXT_SPACE);
		expect(path).toBe(`/app/c/${DID}/social.colibri.beta.channel.text/general`);
		expect(parseChannelPath(path as string)?.channelSpace).toBe(TEXT_SPACE);
	});

	it("still resolves a path written with the old short type", () => {
		expect(parseChannelPath(`/app/c/${DID}/text/general`)?.channelSpace).toBe(
			TEXT_SPACE,
		);
	});

	it("round-trips a voice channel and an encoded skey", () => {
		const space = `at://${DID}/space/social.colibri.beta.channel.voice/off topic`;
		const path = buildChannelPath(space);
		expect(path).toBe(
			`/app/c/${DID}/social.colibri.beta.channel.voice/off%20topic`,
		);
		const target = parseChannelPath(path as string);
		expect(target?.community).toBe(DID);
		expect(target?.channelSkey).toBe("off topic");
		expect(target?.channelSpace).toBe(space);
	});

	it("returns undefined for a space that is not a channel", () => {
		expect(
			buildChannelPath(
				`at://${DID}/space/social.colibri.beta.community.members/self`,
			),
		).toBeUndefined();
		expect(buildChannelPath("not-a-space")).toBeUndefined();
	});
});

describe("parseThreadPath", () => {
	it("reads the thread space out of a nested path", () => {
		expect(parseThreadPath(`${CHANNEL_PATH}/t/3lthread`)).toEqual({
			community: DID,
			threadSkey: "3lthread",
			threadSpace: THREAD_SPACE,
		});
	});

	it("returns nothing for a plain channel path", () => {
		expect(parseThreadPath(CHANNEL_PATH)).toBeNull();
	});

	it("rejects a community segment that is not a did", () => {
		expect(
			parseThreadPath("/app/c/notadid/text/general/t/3lthread"),
		).toBeNull();
	});
});

describe("buildThreadPath", () => {
	it("nests the thread under its channel", () => {
		expect(buildThreadPath(TEXT_SPACE, THREAD_SPACE)).toBe(
			`${CHANNEL_PATH}/t/3lthread`,
		);
	});

	it("returns nothing when the parent is not a channel", () => {
		expect(buildThreadPath(THREAD_SPACE, THREAD_SPACE)).toBeUndefined();
	});
});

describe("buildSpacePath", () => {
	it("builds a channel path straight from a channel space", () => {
		expect(buildSpacePath(TEXT_SPACE)).toBe(CHANNEL_PATH);
	});

	it("cannot place a thread until its parent channel is known", () => {
		forgetThreadParent(THREAD_SPACE);
		expect(buildSpacePath(THREAD_SPACE)).toBeUndefined();
	});

	it("places a thread once its parent channel is known", () => {
		rememberThreadParent(THREAD_SPACE, TEXT_SPACE);
		expect(buildSpacePath(THREAD_SPACE)).toBe(`${CHANNEL_PATH}/t/3lthread`);
		forgetThreadParent(THREAD_SPACE);
	});
});
