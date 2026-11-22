import type { VoiceParticipant } from "@colibri-social/ui";
import { describe, expect, it } from "vitest";
import { callTiles, floatingSubject } from "./tiles";

const VIEWER = "did:plc:viewer";
const PEER = "did:plc:peer";
const QUIET = "did:plc:quiet";

const person = (id: string): VoiceParticipant => ({ id, name: id });
const stream = (label: string) => ({ id: label }) as unknown as MediaStream;

const participants = [person(VIEWER), person(PEER), person(QUIET)];
const everyone = { showNonVideoParticipants: true, showOwnCamera: true };

describe("callTiles", () => {
	it("keeps everyone as avatar tiles without video", () => {
		expect(
			callTiles({ participants, videos: [], viewer: VIEWER, view: everyone }),
		).toEqual(participants);
	});

	it("puts camera streams on the owner's tile and mirrors the viewer", () => {
		const tiles = callTiles({
			participants,
			videos: [
				{ did: PEER, source: "cam", stream: stream("peer") },
				{ did: VIEWER, source: "cam", stream: stream("self") },
			],
			viewer: VIEWER,
			view: everyone,
		});
		expect(tiles.find((tile) => tile.id === PEER)?.stream).toEqual(
			stream("peer"),
		);
		expect(tiles.find((tile) => tile.id === VIEWER)?.mirror).toBe(true);
		expect(tiles.find((tile) => tile.id === PEER)?.mirror).toBeUndefined();
	});

	it("adds a separate tile for a screen share", () => {
		const tiles = callTiles({
			participants,
			videos: [{ did: PEER, source: "screen", stream: stream("screen") }],
			viewer: VIEWER,
			view: everyone,
		});
		expect(tiles[0]).toMatchObject({
			id: PEER,
			kind: "screen",
			key: `s:${PEER}`,
			speaking: false,
		});
		expect(tiles).toHaveLength(4);
	});

	it("hides the viewer's camera when they turned that off", () => {
		const tiles = callTiles({
			participants,
			videos: [{ did: VIEWER, source: "cam", stream: stream("self") }],
			viewer: VIEWER,
			view: { showNonVideoParticipants: true, showOwnCamera: false },
		});
		expect(tiles.find((tile) => tile.id === VIEWER)?.stream).toBeUndefined();
	});

	it("hides people without video only while someone has video", () => {
		const view = { showNonVideoParticipants: false, showOwnCamera: true };
		expect(
			callTiles({
				participants,
				videos: [{ did: PEER, source: "cam", stream: stream("peer") }],
				viewer: VIEWER,
				view,
			}).map((tile) => tile.id),
		).toEqual([PEER]);
		expect(
			callTiles({ participants, videos: [], viewer: VIEWER, view }),
		).toHaveLength(3);
	});
});

describe("floatingSubject", () => {
	const keyOf = (tile: { kind?: string; id: string }) =>
		`${tile.kind === "screen" ? "s" : "p"}:${tile.id}`;
	const screenTile = {
		...person(PEER),
		kind: "screen" as const,
		key: `s:${PEER}`,
		stream: stream("screen"),
	};
	const speaking = { ...person(QUIET), speaking: true };

	it("stays on a screen share while people talk", () => {
		expect(
			floatingSubject([screenTile, person(VIEWER), speaking], {
				focusedKey: null,
				lastSpeaker: QUIET,
				viewer: VIEWER,
				keyOf,
			}),
		).toBe(screenTile);
	});

	it("follows the focused tile, then the speaker, then the viewer", () => {
		const tiles = [screenTile, person(VIEWER), speaking];
		expect(
			floatingSubject(tiles, {
				focusedKey: `p:${QUIET}`,
				lastSpeaker: undefined,
				viewer: VIEWER,
				keyOf,
			}),
		).toBe(speaking);
		expect(
			floatingSubject([person(VIEWER), speaking], {
				focusedKey: null,
				lastSpeaker: undefined,
				viewer: VIEWER,
				keyOf,
			}),
		).toBe(speaking);
		expect(
			floatingSubject([person(PEER), person(VIEWER)], {
				focusedKey: null,
				lastSpeaker: undefined,
				viewer: VIEWER,
				keyOf,
			}),
		).toEqual(person(VIEWER));
	});
});
