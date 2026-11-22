import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type VoiceEngine, type VoiceMove, voiceSocketUrl } from "./engine";
import {
	CHANNEL,
	connect,
	DEFS,
	FakeStream,
	FakeTrack,
	handshake,
	reply,
	setup,
	VIEWER,
} from "./engine-fakes";

let running: VoiceEngine[] = [];

const track = <T extends { engine: VoiceEngine }>(harness: T): T => {
	running.push(harness.engine);
	return harness;
};

beforeEach(() => {
	vi.stubGlobal("MediaStream", FakeStream);
});

afterEach(() => {
	for (const engine of running) engine.dispose();
	running = [];
	vi.unstubAllGlobals();
});

const proposal = (deadline: number) => ({
	$type: `${DEFS}migrationProposal`,
	deadline: new Date(deadline).toISOString(),
	candidates: [
		{
			nodeId: "fsn-1",
			region: "eu",
			signalingUrl: "https://fsn-1.nodes.test",
			probeUrl: "https://fsn-1.nodes.test/health",
		},
		{
			nodeId: "us-1",
			region: "us",
			signalingUrl: "https://us-1.nodes.test",
			probeUrl: "https://us-1.nodes.test/health",
		},
	],
});

describe("call moves", () => {
	it("answers a move proposal with round trips and offers to move now", async () => {
		const probe = vi.fn(async (url: string) =>
			url.includes("fsn-1") ? 24.4 : null,
		);
		const harness = track(setup({ probe }));
		const moves: (VoiceMove | null)[] = [];

		harness.engine.onMove((move) => moves.push(move));

		const { socket } = await connect(harness);
		const deadline = Date.now() + 60_000;

		socket.serve(proposal(deadline));
		await vi.waitFor(() => expect(moves).toHaveLength(1));

		const report = socket.sent.find(
			(frame) => frame.$type === `${DEFS}rttReport`,
		);

		expect(report?.results).toEqual([
			{ nodeId: "fsn-1", rttMs: 24 },
			{ nodeId: "us-1" },
		]);
		expect(moves[0]?.deadline).toBe(deadline);

		moves[0]?.moveNow();

		expect(socket.sent.some((frame) => frame.$type === `${DEFS}moveNow`)).toBe(
			true,
		);
	});

	it("keeps the call running until the new node takes it, then drops the old one", async () => {
		const harness = track(setup());
		const moves: (VoiceMove | null)[] = [];

		harness.engine.onMove((move) => moves.push(move));

		const { socket: old } = await connect(harness);

		old.serve({
			$type: `${DEFS}migrateTo`,
			nodeId: "fsn-1",
			signalingUrl: "https://fsn-1.nodes.test",
			channel: CHANNEL,
		});
		await vi.waitFor(() => expect(harness.sockets).toHaveLength(2));

		const next = harness.sockets[1];

		if (!next) throw new Error("no second socket");

		expect(next.url).toBe(voiceSocketUrl("https://fsn-1.nodes.test"));
		expect(old.closed).toBe(false);
		expect(harness.engine.connection().state).toBe("connected");
		expect(moves).toEqual([null]);

		await handshake(harness, next);

		expect(old.closed).toBe(true);
		expect(harness.engine.connection().state).toBe("connected");
		expect(harness.engine.host()).toBe("https://fsn-1.nodes.test");
		expect(harness.ended).toEqual([]);
	});

	it("stays on the old node when the new one can't be reached", async () => {
		const harness = track(setup());
		const { socket: old } = await connect(harness);

		old.serve({
			$type: `${DEFS}migrateTo`,
			nodeId: "fsn-1",
			signalingUrl: "https://fsn-1.nodes.test",
			channel: CHANNEL,
		});
		await vi.waitFor(() => expect(harness.sockets).toHaveLength(2));
		harness.sockets[1]?.drop();

		expect(old.closed).toBe(false);
		expect(harness.engine.connection().state).toBe("connected");
	});

	it("follows a call that runs on another node", async () => {
		const harness = track(setup({ pickHost: () => "https://us-1.nodes.test" }));

		harness.engine.start({ channel: CHANNEL, muted: false, deafened: false });
		await vi.waitFor(() => expect(harness.sockets).toHaveLength(1));

		const first = harness.sockets[0];

		if (!first) throw new Error("no socket");

		expect(first.url).toBe(voiceSocketUrl("https://us-1.nodes.test"));

		first.open();
		await reply(first, "join", {
			$type: `${DEFS}callElsewhere`,
			nodeId: "fsn-1",
			signalingUrl: "https://fsn-1.nodes.test",
			channel: CHANNEL,
		});
		await vi.waitFor(() => expect(harness.sockets).toHaveLength(2));

		const second = harness.sockets[1];

		if (!second) throw new Error("no second socket");

		expect(second.url).toBe(voiceSocketUrl("https://fsn-1.nodes.test"));
		await handshake(harness, second);
		expect(harness.ended).toEqual([]);
	});

	it("routes media through the relay when the experiment is on", async () => {
		const harness = track(setup({ forceRelay: () => true }));

		await connect(harness);

		expect(harness.devices[0]?.sendOptions?.iceTransportPolicy).toBe("relay");
	});

	it("doesn't warn about a screen share when none was running", async () => {
		const harness = track(setup());
		const { socket } = await connect(harness);

		socket.serve({
			$type: `${DEFS}migrateTo`,
			nodeId: "fsn-1",
			signalingUrl: "https://fsn-1.nodes.test",
			channel: CHANNEL,
		});
		await vi.waitFor(() => expect(harness.sockets).toHaveLength(2));

		expect(harness.notices).not.toContain("screenStoppedByMove");
	});

	it("stops a running screen share when the call moves and says so", async () => {
		const harness = track(setup());
		const { socket } = await connect(harness);
		const changes: boolean[] = [];

		harness.engine.onScreenShare((sharing) => changes.push(sharing));

		const sharing = harness.engine.shareScreen(
			{
				video: new FakeTrack("video") as unknown as MediaStreamTrack,
				audio: null,
				release: vi.fn(),
			},
			{ resolution: "1080", framerate: 15 },
		);

		await reply(socket, "produce", {
			$type: `${DEFS}producerInfo`,
			producerId: "screen-1",
			did: VIEWER,
			kind: "video",
			source: "screen",
		});
		expect(await sharing).toBe(true);

		socket.serve({
			$type: `${DEFS}migrateTo`,
			nodeId: "fsn-1",
			signalingUrl: "https://fsn-1.nodes.test",
			channel: CHANNEL,
		});
		await vi.waitFor(() => expect(harness.sockets).toHaveLength(2));
		harness.sockets[1]?.open();

		await vi.waitFor(() =>
			expect(harness.notices).toContain("screenStoppedByMove"),
		);
		expect(harness.engine.screenSharing()).toBe(false);
		expect(changes).toEqual([true, false]);
	});
});
