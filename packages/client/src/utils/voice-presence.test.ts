import { describe, expect, it } from "vitest";
import {
	authorityOf,
	computePresenceSync,
	effectiveDeafened,
	effectiveMuted,
	type PresenceMember,
	type SelfVoiceState,
} from "./voice-presence";

const HOME = "did:plc:home";
const VC_A = "at://did:plc:home/social.colibri.channel/a";
const VC_B = "at://did:plc:home/social.colibri.channel/b";
const OTHER_VC = "at://did:plc:other/social.colibri.channel/a";

const ALICE = "did:plc:alice";
const BOB = "did:plc:bob";
const ME = "did:plc:me";

const inVoice = (did: string, vc: string, extra?: Partial<PresenceMember>) => ({
	did,
	vc,
	...extra,
});

const sync = (args: {
	members: Array<PresenceMember>;
	presence?: Record<string, Array<string>>;
	ownChannel?: string | null;
	communityAuthority?: string;
	pinned?: ReadonlySet<string>;
}) =>
	computePresenceSync({
		communityAuthority: args.communityAuthority ?? HOME,
		members: args.members,
		presence: args.presence ?? {},
		ownChannel: args.ownChannel ?? null,
		ownDid: ME,
		pinned: args.pinned,
	});

const planFor = (
	plan: ReturnType<typeof computePresenceSync>,
	channel: string,
) => plan.channels.find((c) => c.channel === channel);

describe("authorityOf", () => {
	it("reads the authority out of an at-uri", () => {
		expect(authorityOf(VC_A)).toBe("did:plc:home");
	});

	it("rejects anything that is not an at-uri", () => {
		expect(authorityOf("did:plc:home")).toBeNull();
		expect(authorityOf("at://")).toBeNull();
		expect(authorityOf("")).toBeNull();
	});
});

describe("computePresenceSync", () => {
	it("adds members the snapshot has and we do not", () => {
		const plan = sync({ members: [inVoice(ALICE, VC_A)] });

		expect(planFor(plan, VC_A)?.added).toEqual([ALICE]);
		expect(plan.states).toEqual([
			{
				did: ALICE,
				state: {
					muted: false,
					deafened: false,
					serverMuted: undefined,
					serverDeafened: undefined,
				},
			},
		]);
	});

	it("removes ghosts the snapshot no longer has", () => {
		const plan = sync({ members: [], presence: { [VC_A]: [ALICE] } });

		expect(planFor(plan, VC_A)?.left).toEqual([ALICE]);
		expect(planFor(plan, VC_A)?.added).toEqual([]);
	});

	it("leaves members already in the right channel alone", () => {
		const plan = sync({
			members: [inVoice(ALICE, VC_A)],
			presence: { [VC_A]: [ALICE] },
		});

		expect(plan.channels).toEqual([]);
		expect(plan.states).toHaveLength(1);
	});

	it("reports a move within the community as moved, not left", () => {
		const plan = sync({
			members: [inVoice(ALICE, VC_B)],
			presence: { [VC_A]: [ALICE] },
		});

		expect(planFor(plan, VC_A)?.moved).toEqual([ALICE]);
		expect(planFor(plan, VC_A)?.left).toEqual([]);
		expect(planFor(plan, VC_B)?.added).toEqual([ALICE]);
	});

	it("carries self-mute and server-mute through from the snapshot", () => {
		const plan = sync({
			members: [
				inVoice(ALICE, VC_A, {
					vcMuted: true,
					vcDeafened: true,
					vcServerMuted: true,
					vcServerDeafened: false,
				}),
			],
		});

		expect(plan.states[0].state).toEqual({
			muted: true,
			deafened: true,
			serverMuted: true,
			serverDeafened: false,
		});
	});

	it("leaves the server flags undefined when the snapshot omits them", () => {
		const plan = sync({ members: [inVoice(ALICE, VC_A)] });

		expect(plan.states[0].state.serverMuted).toBeUndefined();
		expect(plan.states[0].state.serverDeafened).toBeUndefined();
	});

	it("ignores channels belonging to another community", () => {
		const plan = sync({
			members: [inVoice(ALICE, OTHER_VC)],
			presence: { [OTHER_VC]: [BOB] },
		});

		expect(plan.channels).toEqual([]);
		expect(plan.states).toEqual([]);
	});

	it("ignores members who are not in any voice channel", () => {
		const plan = sync({ members: [{ did: ALICE }, { did: BOB, vc: null }] });

		expect(plan.channels).toEqual([]);
		expect(plan.states).toEqual([]);
	});

	it("keeps us in our own call even when the snapshot omits us", () => {
		const plan = sync({
			members: [],
			presence: { [VC_A]: [ME] },
			ownChannel: VC_A,
		});

		expect(plan.channels).toEqual([]);
	});

	it("adds us to our own call when presence has not caught up", () => {
		const plan = sync({ members: [], ownChannel: VC_A });

		expect(planFor(plan, VC_A)?.added).toEqual([ME]);
	});

	it("drops our own state from the snapshot while we are connected", () => {
		const plan = sync({
			members: [inVoice(ME, VC_A, { vcMuted: true })],
			ownChannel: VC_A,
		});

		expect(plan.states).toEqual([]);
	});

	it("keeps our state from the snapshot when we are not connected", () => {
		const plan = sync({
			members: [inVoice(ME, VC_A, { vcMuted: true })],
			ownChannel: null,
		});

		expect(plan.states).toHaveLength(1);
		expect(plan.states[0].did).toBe(ME);
	});

	it("does not touch a call we hold in another community", () => {
		const plan = sync({
			members: [],
			presence: { [OTHER_VC]: [ME] },
			ownChannel: OTHER_VC,
		});

		expect(plan.channels).toEqual([]);
	});

	it("returns nothing without a community authority", () => {
		const plan = sync({
			members: [inVoice(ALICE, VC_A)],
			communityAuthority: "",
		});

		expect(plan).toEqual({ channels: [], states: [] });
	});

	it("takes the bare did the community payload carries", () => {
		const plan = sync({ members: [inVoice(ALICE, VC_A)] });

		expect(planFor(plan, VC_A)?.added).toEqual([ALICE]);
	});

	it("reconciles several channels at once", () => {
		const plan = sync({
			members: [inVoice(ALICE, VC_A), inVoice(BOB, VC_B)],
			presence: { [VC_A]: [BOB], [VC_B]: [] },
		});

		expect(planFor(plan, VC_A)?.added).toEqual([ALICE]);
		expect(planFor(plan, VC_A)?.moved).toEqual([BOB]);
		expect(planFor(plan, VC_B)?.added).toEqual([BOB]);
	});
});

describe("effectiveMuted / effectiveDeafened", () => {
	const state = (patch: Partial<SelfVoiceState> = {}): SelfVoiceState => ({
		micEnabled: true,
		deafened: false,
		serverMuted: false,
		serverDeafened: false,
		...patch,
	});

	it("follows local intent when no moderator flag is set", () => {
		expect(effectiveMuted(state())).toBe(false);
		expect(effectiveMuted(state({ micEnabled: false }))).toBe(true);
		expect(effectiveDeafened(state())).toBe(false);
		expect(effectiveDeafened(state({ deafened: true }))).toBe(true);
	});

	it("applies a moderator flag over local intent", () => {
		expect(effectiveMuted(state({ serverMuted: true }))).toBe(true);
		expect(effectiveDeafened(state({ serverDeafened: true }))).toBe(true);
	});

	it("returns the untouched local intent once the flag is lifted", () => {
		expect(effectiveMuted(state({ serverMuted: false }))).toBe(false);
		expect(
			effectiveMuted(state({ micEnabled: false, serverMuted: false })),
		).toBe(true);
		expect(effectiveDeafened(state({ serverDeafened: false }))).toBe(false);
		expect(
			effectiveDeafened(state({ deafened: true, serverDeafened: false })),
		).toBe(true);
	});
});

describe("computePresenceSync with pinned members", () => {
	it("keeps a member the snapshot predates", () => {
		const plan = sync({
			members: [],
			presence: { [VC_A]: [ALICE] },
			pinned: new Set([ALICE]),
		});

		expect(planFor(plan, VC_A)).toBeUndefined();
	});

	it("still removes members that are not pinned", () => {
		const plan = sync({
			members: [],
			presence: { [VC_A]: [ALICE, BOB] },
			pinned: new Set([ALICE]),
		});

		expect(planFor(plan, VC_A)?.left).toEqual([BOB]);
	});

	it("does not move a pinned member the snapshot puts elsewhere", () => {
		const plan = sync({
			members: [inVoice(ALICE, VC_B)],
			presence: { [VC_A]: [ALICE] },
			pinned: new Set([ALICE]),
		});

		expect(planFor(plan, VC_A)).toBeUndefined();
		expect(planFor(plan, VC_B)).toBeUndefined();
	});

	it("leaves a pinned member's state alone", () => {
		const plan = sync({
			members: [inVoice(ALICE, VC_A, { vcMuted: true })],
			presence: { [VC_A]: [ALICE] },
			pinned: new Set([ALICE]),
		});

		expect(plan.states).toEqual([]);
	});

	it("ignores channels outside the community even when pinned", () => {
		const plan = sync({
			members: [],
			presence: { [OTHER_VC]: [ALICE] },
			pinned: new Set([ALICE]),
		});

		expect(plan.channels).toEqual([]);
	});
});
