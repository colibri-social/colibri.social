import { describe, expect, it, vi } from "vitest";
import type { Did, SpaceRef } from "../../data/types";
import { openNotificationTarget } from "./inbox-adapter";

const SPACE = "did:plc:space" as Did;
const VOICE =
	"at://did:plc:space/space/social.colibri.beta.channel.voice/lounge" as SpaceRef;
const TEXT =
	"at://did:plc:space/space/social.colibri.beta.channel.text/general" as SpaceRef;

const navigator = () => ({ setRoot: vi.fn(), push: vi.fn() });

describe("openNotificationTarget", () => {
	it("opens the voice chat for a voice channel notification", () => {
		const stack = navigator();
		const openVoiceChat = vi.fn();
		openNotificationTarget(
			stack,
			() => {},
			{ community: SPACE, channel: VOICE },
			openVoiceChat,
		);
		expect(stack.push).toHaveBeenCalledWith({
			kind: "chat",
			space: SPACE,
			channel: "lounge",
			channelType: "social.colibri.beta.channel.voice",
		});
		expect(openVoiceChat).toHaveBeenCalledWith(true);
	});

	it("leaves the voice chat alone for a text channel notification", () => {
		const openVoiceChat = vi.fn();
		openNotificationTarget(
			navigator(),
			() => {},
			{ community: SPACE, channel: TEXT },
			openVoiceChat,
		);
		expect(openVoiceChat).not.toHaveBeenCalled();
	});
});
