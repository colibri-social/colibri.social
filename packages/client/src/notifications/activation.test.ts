import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	captureNotificationActivationFromUrl,
	emitNotificationActivation,
	onNotificationActivation,
	parsePushActivation,
	takeCapturedFocusMessageUri,
} from "./activation";

const CHANNEL =
	"at://did:plc:community/space/social.colibri.beta.channel.text/general";
const AUTHOR = "did:plc:author00000000000000000000";
const MESSAGE = `${CHANNEL}/${AUTHOR}/social.colibri.beta.message/3lkmsg1`;

describe("parsePushActivation", () => {
	it("composes the message URI from the AppView's channel, author and rkey", () => {
		expect(
			parsePushActivation({
				channel: CHANNEL,
				messageAuthor: AUTHOR,
				messageRkey: "3lkmsg1",
			}),
		).toEqual({ channelUri: CHANNEL, messageUri: MESSAGE });
	});

	it("prefers the resolved channelUri and messageUri when they are present", () => {
		expect(
			parsePushActivation({
				channel: "at://did:plc:other/space/x/y",
				channelUri: CHANNEL,
				messageAuthor: AUTHOR,
				messageRkey: "3lkmsg1",
				messageUri: MESSAGE,
			}),
		).toEqual({ channelUri: CHANNEL, messageUri: MESSAGE });
	});

	it("keeps the channel when there is nothing to focus", () => {
		expect(parsePushActivation({ channel: CHANNEL })).toEqual({
			channelUri: CHANNEL,
			messageUri: undefined,
		});
	});

	it("leaves the message URI off when the channel is not a space ref", () => {
		expect(
			parsePushActivation({
				channel:
					"at://did:plc:community/social.colibri.beta.channel.text/general",
				messageAuthor: AUTHOR,
				messageRkey: "3lkmsg1",
			}),
		).toEqual({
			channelUri:
				"at://did:plc:community/social.colibri.beta.channel.text/general",
			messageUri: undefined,
		});
	});

	it("rejects a payload with no channel reference", () => {
		expect(parsePushActivation({ messageRkey: "3lkmsg1" })).toBeUndefined();
		expect(parsePushActivation({ channel: "" })).toBeUndefined();
		expect(parsePushActivation(undefined)).toBeUndefined();
		expect(parsePushActivation("nope")).toBeUndefined();
	});
});

describe("onNotificationActivation", () => {
	it("delivers to every subscriber until it unsubscribes", () => {
		const first = vi.fn();
		const second = vi.fn();
		const unsubscribe = onNotificationActivation(first);
		const stopSecond = onNotificationActivation(second);

		emitNotificationActivation({ channelUri: CHANNEL });
		expect(first).toHaveBeenCalledWith({ channelUri: CHANNEL });
		expect(second).toHaveBeenCalledTimes(1);

		unsubscribe();
		emitNotificationActivation({ channelUri: CHANNEL, messageUri: MESSAGE });
		expect(first).toHaveBeenCalledTimes(1);
		expect(second).toHaveBeenCalledTimes(2);

		stopSecond();
	});
});

describe("captureNotificationActivationFromUrl", () => {
	const path =
		"/app/c/did:plc:community/social.colibri.beta.channel.text/general";

	const setUrl = (url: string) => {
		const replaceState = vi.fn();
		vi.stubGlobal("window", {
			location: { href: `https://colibri.social${url}` },
			history: { state: { _depth: 3 }, replaceState },
		});
		return replaceState;
	};

	beforeEach(() => {
		takeCapturedFocusMessageUri();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("takes the focus hint and strips only that param", () => {
		const replaceState = setUrl(
			`${path}?pane=nav&m=${encodeURIComponent(MESSAGE)}`,
		);

		captureNotificationActivationFromUrl();

		expect(replaceState).toHaveBeenCalledWith(
			{ _depth: 3 },
			"",
			`${path}?pane=nav`,
		);
		expect(takeCapturedFocusMessageUri()).toBe(MESSAGE);
		expect(takeCapturedFocusMessageUri()).toBeUndefined();
	});

	it("leaves a URL without the param alone", () => {
		const replaceState = setUrl(`${path}?pane=nav`);

		captureNotificationActivationFromUrl();

		expect(replaceState).not.toHaveBeenCalled();
		expect(takeCapturedFocusMessageUri()).toBeUndefined();
	});
});
