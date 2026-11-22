import { createRoot } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { spaceKey } from "../../data/ids";
import { createMockSource, setLatency } from "../../data/mock/source";
import { createDataStore } from "../../data/store";
import type { Did } from "../../data/types";
import { setVoiceSoundPlayer, voice } from "../../data/voice";
import { participantVolumes } from "../../data/voice/volumes";
import { createVoiceSoundPlayer } from "../../data/voice-sounds";
import { voiceMemberMenu } from "./member-voice";

const HQ = "did:plc:colibrihqspace2a4b6c8d";

let dispose: (() => void) | undefined;

afterEach(() => {
	voice.leave();
	setVoiceSoundPlayer(createVoiceSoundPlayer());
	dispose?.();
	dispose = undefined;
});

const mount = async () => {
	setLatency(0);
	setVoiceSoundPlayer(() => {});
	const store = createRoot((stop) => {
		dispose = stop;
		return createDataStore(createMockSource({ live: false }));
	});
	await vi.waitFor(() =>
		expect(store.communities.value()?.some((entry) => entry.did === HQ)).toBe(
			true,
		),
	);
	const community = store.communities
		.value()
		?.find((entry) => entry.did === HQ);
	if (!community) throw new Error("missing HQ");
	const space = store.space(community);
	await vi.waitFor(() =>
		expect(space.members.value()?.length).toBeGreaterThan(0),
	);
	const peer = space.members
		.value()
		?.map((member) => member.actor.did)
		.find((did) => voice.channelOf(did));
	if (!peer) throw new Error("nobody is in voice");
	const channel = voice.channelOf(peer) as string;
	return { store, key: spaceKey(community), peer, channel };
};

const target = (did: string, space: string) => ({ did, space });

describe("voiceMemberMenu", () => {
	it("has nothing for someone who isn't in voice", async () => {
		const { store, key } = await mount();
		expect(voiceMemberMenu(store, target("did:plc:nobody", key))).toBe(
			undefined,
		);
	});

	it("offers volume only once the viewer is in the same call", async () => {
		const { store, key, peer, channel } = await mount();
		expect(voiceMemberMenu(store, target(peer, key))?.onVolumeChange).toBe(
			undefined,
		);
		voice.join({ space: key, channel });
		const menu = voiceMemberMenu(store, target(peer, key));
		expect(menu?.volume).toBe(100);
		menu?.onVolumeChange?.(150);
		expect(participantVolumes().volume(peer, "voice")).toBe(150);
		expect(menu?.onStreamVolumeChange).toBeUndefined();
		expect(menu?.onStreamMutedChange).toBeUndefined();
		participantVolumes().setVolume(peer, "voice", 100);
	});

	it("offers the viewer's own call settings on their entry", async () => {
		const { store, key, channel } = await mount();
		voice.join({ space: key, channel });
		await vi.waitFor(() =>
			expect(voice.channelOf(store.viewer.did)).toBe(channel),
		);
		const menu = voiceMemberMenu(store, target(store.viewer.did, key));
		expect(menu?.onVolumeChange).toBeUndefined();
		expect(menu?.onServerMutedChange).toBeUndefined();
		expect(menu?.showOwnCamera).toBe(true);
		menu?.onSelfMutedChange?.(true);
		expect(voice.muted()).toBe(true);
		menu?.onSelfDeafenedChange?.(true);
		expect(voice.deafened()).toBe(true);
	});

	it("lets someone with the voice permission server mute a peer", async () => {
		const { store, key, peer } = await mount();
		const menu = voiceMemberMenu(store, target(peer, key));
		expect(menu?.onServerMutedChange).toBeDefined();
		expect(menu?.serverMuted).toBe(false);
		menu?.onServerMutedChange?.(true);
		await vi.waitFor(() =>
			expect(voice.moderationOf(peer as Did).serverMuted).toBe(true),
		);
		menu?.onDisconnect?.();
		await vi.waitFor(() => expect(voice.channelOf(peer)).toBeUndefined());
	});

	it("lets someone with the voice permission move a peer to another voice channel", async () => {
		const { store, key, peer, channel } = await mount();
		const community = store.spaceByKey(key);
		if (!community) throw new Error("missing HQ");
		await vi.waitFor(() =>
			expect(store.space(community).channels.value()?.length).toBeGreaterThan(
				0,
			),
		);
		const menu = voiceMemberMenu(store, target(peer, key));
		const targets = menu?.moveTargets ?? [];
		expect(targets.length).toBeGreaterThan(0);
		expect(targets.map((entry) => entry.id)).not.toContain(channel);
		const destination = targets[0]?.id as string;
		menu?.onMove?.(destination);
		await vi.waitFor(() => expect(voice.channelOf(peer)).toBe(destination));
	});
});
