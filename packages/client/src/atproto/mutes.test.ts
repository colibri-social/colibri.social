import { describe, expect, it } from "vitest";
import {
	decodeMuteSubject,
	encodeMuteSubject,
	type MuteSubject,
	muteSubjectKey,
} from "./mutes";

describe("encodeMuteSubject / decodeMuteSubject", () => {
	it("round-trips an actor subject", () => {
		const subject: MuteSubject = { kind: "actor", did: "did:plc:abc123" };
		expect(decodeMuteSubject(encodeMuteSubject(subject))).toEqual(subject);
	});

	it("round-trips a channel subject", () => {
		const subject: MuteSubject = {
			kind: "channel",
			channel:
				"at://did:plc:abc123/space/social.colibri.beta.channel.text/general",
		};
		expect(decodeMuteSubject(encodeMuteSubject(subject))).toEqual(subject);
	});

	it("decodes an unrecognised $type to undefined", () => {
		const future = {
			$type: "social.colibri.beta.actor.defs#mutedFuture",
			did: "did:plc:abc123",
		} as unknown as Parameters<typeof decodeMuteSubject>[0];
		expect(decodeMuteSubject(future)).toBeUndefined();
	});
});

describe("muteSubjectKey", () => {
	it("does not collide when a DID and a channel space ref share trailing text", () => {
		const actor: MuteSubject = { kind: "actor", did: "did:plc:trailing" };
		const channel: MuteSubject = {
			kind: "channel",
			channel:
				"at://did:plc:owner/space/social.colibri.beta.channel.text/trailing",
		};
		expect(muteSubjectKey(actor)).not.toBe(muteSubjectKey(channel));
	});

	it("is stable for the same subject", () => {
		const subject: MuteSubject = { kind: "actor", did: "did:plc:abc123" };
		expect(muteSubjectKey(subject)).toBe(muteSubjectKey({ ...subject }));
	});
});
