import { skeyOf } from "../ids";
import type { LiveEvent } from "../source";
import type { Did, Presence, SpaceRef, VoiceState } from "../types";
import { createRandom } from "./seed";
import type { World } from "./world";

const SEEDED_ROOMS: {
	space: string;
	skey: string;
	count: number;
	sharing?: Partial<Record<number, "camera" | "screen">>;
}[] = [
	{ space: "hq", skey: "lounge", count: 3 },
	{
		space: "owls",
		skey: "draw-along",
		count: 4,
		sharing: { 0: "screen", 3: "camera" },
	},
	{ space: "owls", skey: "quiet-studio", count: 1 },
];

export const VOICE_TICK_MS = 1_400;

const voiceRef = (world: World, spaceKey: string, skey: string) =>
	world.spaces
		.find((entry) => entry.seed.key === spaceKey)
		?.channels.find((entry) => skeyOf(entry.view.space) === skey)?.view.space;

const candidates = (world: World, spaceKey: string) => {
	const space = world.spaces.find((entry) => entry.seed.key === spaceKey);
	return (space?.seed.members ?? []).filter((key) => {
		const person = world.people.byKey.get(key);
		if (!person || person.bot || person.did === world.viewerDid) return false;
		const state = world.people.presenceOf(person.did)?.onlineState;
		return state === "online" || state === "away";
	});
};

const setVoice = (world: World, did: Did, voice: VoiceState | undefined) => {
	const current = world.people.presenceOf(did) ?? { onlineState: "online" };
	const next: Presence = { ...current };
	if (voice) next.voice = voice;
	else delete next.voice;
	world.people.setPresence(did, next);
	return next;
};

export const seedVoice = (world: World) => {
	const taken = new Set<string>();
	for (const room of SEEDED_ROOMS) {
		const channel = voiceRef(world, room.space, room.skey);
		if (!channel) continue;
		const people = candidates(world, room.space)
			.filter((key) => !taken.has(key))
			.slice(0, room.count);
		people.forEach((key, index) => {
			taken.add(key);
			setVoice(world, world.people.didOf(key), {
				channel,
				muted: index === 1 ? true : undefined,
				deafened: index === 2 && room.count > 3 ? true : undefined,
				...(room.sharing?.[index] ? { [room.sharing[index]]: true } : {}),
			});
		});
	}
};

export const startVoiceActivity = (options: {
	world: World;
	emit: (event: LiveEvent) => void;
	later: (ms: number, run: () => void) => void;
}) => {
	const { world, emit, later } = options;
	const random = createRandom(0x7015e);
	const speaking = new Set<Did>();

	const rooms = () =>
		SEEDED_ROOMS.map((room) => ({
			...room,
			channel: voiceRef(world, room.space, room.skey),
		})).filter(
			(room): room is typeof room & { channel: SpaceRef } => !!room.channel,
		);

	const inRoom = (channel: SpaceRef) =>
		world.people.all.filter(
			(person) =>
				person.did !== world.viewerDid &&
				world.people.presenceOf(person.did)?.voice?.channel === channel,
		);

	const setSpeaking = (did: Did, value: boolean) => {
		if (speaking.has(did) === value) return;
		if (value) speaking.add(did);
		else speaking.delete(did);
		emit({ $type: "voiceActivityEvent", did, speaking: value });
	};

	const publish = (did: Did, voice: VoiceState | undefined) => {
		if (!voice) setSpeaking(did, false);
		emit({
			$type: "presenceEvent",
			did,
			presence: setVoice(world, did, voice),
		});
	};

	const tick = () => {
		for (const room of rooms()) {
			const people = inRoom(room.channel);
			for (const person of people) {
				const voice = world.people.presenceOf(person.did)?.voice;
				const silent = !!voice?.muted || !!voice?.deafened;
				const talking = speaking.has(person.did);
				if (silent) setSpeaking(person.did, false);
				else if (talking ? random.chance(0.45) : random.chance(0.2)) {
					setSpeaking(person.did, !talking);
				}
			}
			const roll = random.next();
			const first = people[0];
			if (roll < 0.03 && first) {
				const voice = world.people.presenceOf(first.did)?.voice;
				if (voice) publish(first.did, { ...voice, muted: !voice.muted });
			} else if (roll < 0.05 && people.length > 1) {
				publish(random.pick(people).did, undefined);
			} else if (roll < 0.08 && people.length < room.count + 2) {
				const key = candidates(world, room.space).find(
					(entry) => !world.people.presenceOf(world.people.didOf(entry))?.voice,
				);
				if (key) publish(world.people.didOf(key), { channel: room.channel });
			}
		}
		later(VOICE_TICK_MS, tick);
	};

	later(VOICE_TICK_MS, tick);
};
