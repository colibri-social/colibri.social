import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type VoiceEngine, voiceSocketUrl } from "./engine";
import {
	CHANNEL,
	connect,
	DEFS,
	type FakeSocket,
	FakeStream,
	handshake,
	reply,
	setup,
} from "./engine-fakes";

const NODE_A = "https://a.nodes.test";
const NODE_B = "https://b.nodes.test";

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

const pickFrom =
	(nodes: string[]) =>
	(avoid: ReadonlySet<string>): string | null =>
		nodes.find((node) => !avoid.has(node)) ?? null;

const twoNodes = (overrides: Parameters<typeof setup>[0] = {}) => {
	return track(
		setup({
			pickHost: pickFrom([NODE_A, NODE_B]),
			describeNode: (host) =>
				host === NODE_A
					? { id: "fsn-1", region: "eu" }
					: { id: "us-1", region: "us" },
			...overrides,
		}),
	);
};

const socketAt = async (
	harness: ReturnType<typeof setup>,
	index: number,
): Promise<FakeSocket> => {
	await vi.waitFor(() => expect(harness.sockets.length).toBeGreaterThan(index));

	const socket = harness.sockets[index];

	if (!socket) throw new Error(`no socket ${index}`);

	return socket;
};

const serverError = (error: string) => ({
	$type: `${DEFS}error`,
	error,
	message: "the node is unwell",
});

const join = (harness: ReturnType<typeof setup>) => {
	harness.engine.start({ channel: CHANNEL, muted: false, deafened: false });
};

describe("voice node fallback", () => {
	it("moves on to the next node when the first one can't be reached", async () => {
		const harness = twoNodes();

		join(harness);

		const first = await socketAt(harness, 0);

		expect(first.url).toBe(voiceSocketUrl(NODE_A));
		first.drop();

		const second = await socketAt(harness, 1);

		expect(second.url).toBe(voiceSocketUrl(NODE_B));
		await handshake(harness, second);

		expect(harness.engine.connection().state).toBe("connected");
		expect(harness.ended).toEqual([]);
		expect(harness.notices).toEqual([]);
	});

	it("moves on when a node answers the join with a server error", async () => {
		const harness = twoNodes();

		join(harness);

		const first = await socketAt(harness, 0);

		first.open();
		await reply(first, "join", serverError("InternalError"));

		const second = await socketAt(harness, 1);

		expect(second.url).toBe(voiceSocketUrl(NODE_B));
		await handshake(harness, second);
		expect(harness.ended).toEqual([]);
	});

	it("moves on when the media connection fails before it ever connects", async () => {
		const harness = twoNodes();
		const { socket } = await connect(harness);
		const transport = harness.devices[0]?.send;
		const onState = transport?.handlers.get("connectionstatechange") as
			| ((state: string) => void)
			| undefined;

		onState?.("failed");

		const second = await socketAt(harness, 1);

		expect(socket.closed).toBe(true);
		expect(second.url).toBe(voiceSocketUrl(NODE_B));
		expect(harness.ended).toEqual([]);
	});

	it("ends with nodesDown once every voice node failed", async () => {
		const harness = twoNodes();

		join(harness);

		const first = await socketAt(harness, 0);

		first.open();
		await reply(first, "join", serverError("VoiceUnavailable"));

		const second = await socketAt(harness, 1);

		second.drop();

		await vi.waitFor(() => expect(harness.ended).toEqual(["nodesDown"]));
		expect(harness.sockets).toHaveLength(2);
		expect(harness.engine.connection().state).toBe("disconnected");
	});

	it("tries every node again on the next join", async () => {
		const harness = twoNodes();

		join(harness);
		(await socketAt(harness, 0)).drop();
		(await socketAt(harness, 1)).drop();
		await vi.waitFor(() => expect(harness.ended).toEqual(["nodesDown"]));

		join(harness);

		const retry = await socketAt(harness, 2);

		expect(retry.url).toBe(voiceSocketUrl(NODE_A));
	});

	it("doesn't move on when the microphone is blocked", async () => {
		const harness = twoNodes({
			media: {
				getUserMedia: async () => {
					throw new DOMException("denied", "NotAllowedError");
				},
			},
		});

		join(harness);

		const socket = await socketAt(harness, 0);

		socket.open();
		await reply(socket, "join", { $type: `${DEFS}joined`, channel: CHANNEL });
		await reply(socket, "getRtpCapabilities", {
			$type: `${DEFS}rtpCapabilities`,
			payload: { codecs: [] },
		});
		await reply(socket, "createTransport", {
			$type: `${DEFS}transportOptions`,
			id: "send-1",
			iceParameters: {},
			iceCandidates: [],
			dtlsParameters: { fingerprints: [], role: "auto" },
			direction: "send",
		});
		await reply(socket, "createTransport", {
			$type: `${DEFS}transportOptions`,
			id: "recv-1",
			iceParameters: {},
			iceCandidates: [],
			dtlsParameters: { fingerprints: [], role: "auto" },
			direction: "recv",
		});

		await vi.waitFor(() =>
			expect(harness.engine.connection().state).toBe("connected"),
		);
		expect(harness.engine.micAvailable()).toBe(false);
		expect(harness.notices).toContain("noMicrophone");
		expect(harness.sockets).toHaveLength(1);
		expect(harness.ended).toEqual([]);
	});

	it("doesn't move on when the server refuses the join", async () => {
		const harness = twoNodes();

		join(harness);

		const socket = await socketAt(harness, 0);

		socket.open();
		await reply(socket, "join", serverError("Forbidden"));

		await vi.waitFor(() => expect(harness.ended).toEqual(["failed"]));
		expect(harness.sockets).toHaveLength(1);
	});

	it("reconnects to another node after a call on the first one drops", async () => {
		const harness = twoNodes();
		const { socket } = await connect(harness);

		socket.drop();

		await vi.waitFor(() => expect(harness.sockets.length).toBeGreaterThan(1), {
			timeout: 3_000,
		});
		expect(harness.sockets[1]?.url).toBe(voiceSocketUrl(NODE_B));
		expect(harness.ended).toEqual([]);
	});

	it("reconnects to the same node when it's the only one", async () => {
		const harness = track(setup({ pickHost: pickFrom([NODE_A]) }));
		const { socket } = await connect(harness);

		socket.drop();

		await vi.waitFor(() => expect(harness.sockets.length).toBeGreaterThan(1), {
			timeout: 3_000,
		});
		expect(harness.sockets[1]?.url).toBe(voiceSocketUrl(NODE_A));
	});

	it("describes the node in the debug snapshot", async () => {
		const harness = twoNodes();

		join(harness);
		(await socketAt(harness, 0)).drop();
		await handshake(harness, await socketAt(harness, 1));

		const snapshot = await harness.engine.debugSnapshot();

		expect(snapshot.node).toEqual({
			host: NODE_B,
			id: "us-1",
			region: "us",
			relayOnly: false,
			hops: 0,
		});
		expect(snapshot.failedHosts).toEqual([NODE_A]);
		expect(snapshot.transports.map((entry) => entry.direction)).toEqual([
			"send",
			"recv",
		]);
	});
});
