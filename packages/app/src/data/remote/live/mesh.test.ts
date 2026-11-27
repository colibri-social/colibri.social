import {
	activityFrame,
	type ClientFrame,
	typingFrame,
	viewChannelFrame,
} from "@colibri-social/lib";
import { createSignal } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import type { LiveEvent } from "../../source";
import type { LiveConnection } from "./connection";
import type { SubscriptionTarget } from "./ledger";
import { createLiveMesh } from "./mesh";

const HOME = "did:web:home.example";
const MARKET = "did:web:market.example";
const OTHER = "did:web:other.example";
const LOCAL_SPACE = "did:plc:localspace";
const MARKET_SPACE = "did:plc:marketspace";
const MARKET_CHANNEL = `at:space/${MARKET_SPACE}/social.colibri.beta.channel.text/general`;
const LOCAL_CHANNEL = `at:space/${LOCAL_SPACE}/social.colibri.beta.channel.text/general`;

type Fake = LiveConnection & {
	sent: ClientFrame[];
	watched: SubscriptionTarget[];
	released: SubscriptionTarget[];
	closed: boolean;
	emit: (event: LiveEvent) => void;
	setEpoch: (epoch: number | undefined) => void;
};

const fakeConnection = (): Fake => {
	const listeners = new Set<(event: LiveEvent) => void>();
	const [epoch, setEpoch] = createSignal<number | undefined>(1);

	const nothing = {
		communities: new Set<string>(),
		channels: new Set<string>(),
	};

	const fake = {
		sent: [] as ClientFrame[],
		watched: [] as SubscriptionTarget[],
		released: [] as SubscriptionTarget[],
		closed: false,
		emit: (event: LiveEvent) => {
			for (const listener of listeners) listener(event);
		},
		setEpoch,
		subscribe: (listener: (event: LiveEvent) => void) => {
			listeners.add(listener);

			return () => listeners.delete(listener);
		},
		status: () => "open" as const,
		epoch,
		retryAt: () => undefined,
		close: () => {
			fake.closed = true;
		},
		retry: vi.fn(),
		watch: (target: SubscriptionTarget) => {
			fake.watched.push(target);

			return () => fake.released.push(target);
		},
		send: (frame: ClientFrame) => {
			fake.sent.push(frame);

			return true;
		},
		granted: () => nothing,
		denied: () => nothing,
		host: () => "wss://home.example/xrpc",
		writeMode: () => "normal" as const,
		drain: () => undefined,
		moveTo: () => {},
	};

	return fake as unknown as Fake;
};

const setup = () => {
	const home = fakeConnection();
	const remotes = new Map<string, Fake>();

	const connect = vi.fn((app: string) => {
		const connection = fakeConnection();

		remotes.set(app, connection);

		return connection;
	});

	const mesh = createLiveMesh({ home, homeApp: HOME, connect });

	mesh.assign(
		new Map([
			[LOCAL_SPACE, HOME],
			[MARKET_SPACE, MARKET],
		]),
	);

	return { home, remotes, connect, mesh };
};

describe("createLiveMesh", () => {
	it("watches each Space on the server that manages it", () => {
		const { home, remotes, connect, mesh } = setup();

		mesh.watch({ communities: [LOCAL_SPACE, MARKET_SPACE] });

		expect(connect).toHaveBeenCalledOnce();
		expect(connect).toHaveBeenCalledWith(MARKET);
		expect(home.watched).toEqual([
			{ communities: [LOCAL_SPACE], channels: [] },
		]);
		expect(remotes.get(MARKET)?.watched).toEqual([
			{ communities: [MARKET_SPACE], channels: [] },
		]);
	});

	it("opens no socket for a server nothing is watched on", () => {
		const { connect, mesh } = setup();

		mesh.watch({ channels: [LOCAL_CHANNEL] });

		expect(connect).not.toHaveBeenCalled();
	});

	it("closes a server's socket once nothing on it is watched", () => {
		const { remotes, mesh } = setup();
		const releaseSpace = mesh.watch({ communities: [MARKET_SPACE] });
		const releaseChannel = mesh.watch({ channels: [MARKET_CHANNEL] });

		releaseSpace();
		expect(remotes.get(MARKET)?.closed).toBe(false);

		releaseChannel();
		expect(remotes.get(MARKET)?.closed).toBe(true);
	});

	it("routes channel frames by Space and presence frames everywhere", () => {
		const { home, remotes, mesh } = setup();

		mesh.watch({ communities: [MARKET_SPACE] });

		const market = remotes.get(MARKET) as Fake;

		mesh.send(typingFrame(MARKET_CHANNEL as never));
		mesh.send(activityFrame());

		expect(market.sent).toEqual([
			typingFrame(MARKET_CHANNEL as never),
			activityFrame(),
		]);
		expect(home.sent).toEqual([activityFrame()]);
	});

	it("stops viewing on one server when a channel on another opens", () => {
		const { home, remotes, mesh } = setup();

		mesh.watch({ communities: [MARKET_SPACE] });
		mesh.send(viewChannelFrame(LOCAL_CHANNEL as never));
		mesh.send(viewChannelFrame(MARKET_CHANNEL as never));

		expect(home.sent).toEqual([
			viewChannelFrame(LOCAL_CHANNEL as never),
			viewChannelFrame(),
		]);
		expect(remotes.get(MARKET)?.sent).toEqual([
			viewChannelFrame(MARKET_CHANNEL as never),
		]);
	});

	it("passes on events from every server", () => {
		const { home, remotes, mesh } = setup();
		const events: LiveEvent[] = [];

		mesh.subscribe((event) => events.push(event));
		mesh.watch({ communities: [MARKET_SPACE] });

		const local = { $type: "local" } as unknown as LiveEvent;
		const remote = { $type: "remote" } as unknown as LiveEvent;

		home.emit(local);
		remotes.get(MARKET)?.emit(remote);

		expect(events).toEqual([local, remote]);
	});

	it("moves watches when a Space changes servers", () => {
		const { remotes, mesh } = setup();

		mesh.watch({ communities: [MARKET_SPACE] });
		mesh.assign(
			new Map([
				[LOCAL_SPACE, HOME],
				[MARKET_SPACE, OTHER],
			]),
		);

		expect(remotes.get(MARKET)?.closed).toBe(true);
		expect(remotes.get(OTHER)?.watched).toEqual([
			{ communities: [MARKET_SPACE], channels: [] },
		]);
	});

	it("bumps the epoch when another server's socket resubscribes", () => {
		const { home, remotes, mesh } = setup();

		mesh.watch({ communities: [MARKET_SPACE] });

		const before = mesh.epoch();
		const market = remotes.get(MARKET) as Fake;

		market.setEpoch(undefined);
		expect(mesh.epoch()).toBe(before);

		market.setEpoch(2);
		expect(mesh.epoch()).toBeGreaterThan(before ?? 0);

		home.setEpoch(undefined);
		expect(mesh.epoch()).toBeUndefined();
	});

	it("falls back to this server when a socket can't be opened", () => {
		const home = fakeConnection();
		const mesh = createLiveMesh({
			home,
			homeApp: HOME,
			connect: () => undefined,
		});

		mesh.assign(new Map([[MARKET_SPACE, "did:plc:notweb"]]));
		mesh.watch({ communities: [MARKET_SPACE] });

		expect(home.watched).toEqual([
			{ communities: [MARKET_SPACE], channels: [] },
		]);
	});
});
