import { describe, expect, it, vi } from "vitest";
import {
	createHistorySync,
	depthOf,
	type ExternalNavigation,
	type HistoryPort,
} from "./history-sync";
import { parsePath, type Route } from "./layers";

const fakeHistory = () => {
	const entries: { state: unknown; url: string }[] = [
		{ state: null, url: "/" },
	];
	let index = 0;
	const listeners = new Set<() => void>();
	const queue: (() => void)[] = [];
	const port: HistoryPort = {
		state: () => entries[index]?.state,
		path: () => entries[index]?.url ?? "/",
		push: (state, url) => {
			entries.splice(index + 1);
			entries.push({ state, url });
			index++;
		},
		replace: (state, url) => {
			entries[index] = { state, url };
		},
		go: (delta) => {
			queue.push(() => {
				index = Math.max(0, Math.min(entries.length - 1, index + delta));
				for (const listener of listeners) listener();
			});
		},
		onPop: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
	const flush = () => {
		while (queue.length) queue.shift()?.();
	};
	const back = () => {
		port.go(-1);
		flush();
	};
	return { port, entries: () => entries, index: () => index, flush, back };
};

describe("history sync", () => {
	it("seeds one entry per layer for a deep link", () => {
		const history = fakeHistory();
		const route = parsePath(
			"/app/c/did:plc:hq/social.colibri.beta.channel.text/general/members",
		);
		const sync = createHistorySync({
			port: history.port,
			route: () => route,
			onExternal: () => {},
		});
		sync.seed(route);
		expect(history.entries().map((entry) => entry.url)).toEqual([
			"/app/c/did:plc:hq",
			"/app/c/did:plc:hq/social.colibri.beta.channel.text/general",
			"/app/c/did:plc:hq/social.colibri.beta.channel.text/general/members",
		]);
		expect(depthOf(history.port.state())).toBe(2);
	});

	it("pushes when a layer opens and pops when it closes", () => {
		const history = fakeHistory();
		let route: Route = parsePath("/app/c/did:plc:hq");
		const sync = createHistorySync({
			port: history.port,
			route: () => route,
			onExternal: () => {},
		});
		sync.seed(route);
		route = parsePath(
			"/app/c/did:plc:hq/social.colibri.beta.channel.text/general",
		);
		sync.sync();
		expect(history.port.path()).toBe(
			"/app/c/did:plc:hq/social.colibri.beta.channel.text/general",
		);
		route = parsePath("/app/c/did:plc:hq");
		sync.sync();
		history.flush();
		expect(history.port.path()).toBe("/app/c/did:plc:hq");
		expect(history.index()).toBe(0);
	});

	it("takes over a closing overlay's entry when a layer opens from it", () => {
		const history = fakeHistory();
		let route: Route = parsePath("/app/c/did:plc:hq");
		const sync = createHistorySync({
			port: history.port,
			route: () => route,
			onExternal: () => {},
		});
		sync.seed(route);
		history.port.push(
			{ colibriDepth: 0, colibriOverlay: 1 },
			"/app/c/did:plc:hq",
		);
		route = parsePath("/app/c/did:plc:hq/manage/overview");
		sync.sync();
		expect(history.entries()).toHaveLength(2);
		expect(history.port.path()).toBe("/app/c/did:plc:hq/manage/overview");
		expect(depthOf(history.port.state())).toBe(1);
		history.back();
		expect(history.port.path()).toBe("/app/c/did:plc:hq");
		expect(history.index()).toBe(0);
	});

	it("writes a deep link's back stack on the first interaction", () => {
		const history = fakeHistory();
		let activate: (() => void) | undefined;
		history.port.whenActivated = (run) => {
			activate = run;
		};
		const route = parsePath("/app/c/did:plc:hq/manage/role/r1");
		const sync = createHistorySync({
			port: history.port,
			route: () => route,
			onExternal: () => {},
		});
		sync.seed(route);
		expect(history.entries()).toHaveLength(1);
		expect(depthOf(history.port.state())).toBe(3);
		expect(history.port.path()).toBe("/app/c/did:plc:hq/manage/role/r1");
		activate?.();
		expect(history.entries().map((entry) => entry.url)).toEqual([
			"/app/c/did:plc:hq",
			"/app/c/did:plc:hq/manage/overview",
			"/app/c/did:plc:hq/manage/roles",
			"/app/c/did:plc:hq/manage/role/r1",
		]);
		history.back();
		expect(history.port.path()).toBe("/app/c/did:plc:hq/manage/roles");
	});

	it("writes the deep link's back stack before navigating without an interaction", () => {
		const history = fakeHistory();
		history.port.whenActivated = () => {};
		let route = parsePath("/app/c/did:plc:hq/manage/profile");
		const sync = createHistorySync({
			port: history.port,
			route: () => route,
			onExternal: () => {},
		});
		sync.seed(route);
		expect(history.entries()).toHaveLength(1);
		route = parsePath("/app/c/did:plc:hq/manage/overview");
		sync.sync();
		history.flush();
		expect(history.port.path()).toBe("/app/c/did:plc:hq/manage/overview");
		expect(history.index()).toBe(1);
	});

	it("waits for a back that's still in flight before pushing", () => {
		const history = fakeHistory();
		let busy = false;
		const idle: (() => void)[] = [];
		history.port.busy = () => busy;
		history.port.whenIdle = (run) => idle.push(run);
		let route: Route = parsePath("/app/c/did:plc:hq");
		const sync = createHistorySync({
			port: history.port,
			route: () => route,
			onExternal: () => {},
		});
		sync.seed(route);
		history.port.push(
			{ colibriDepth: 0, colibriOverlay: 1 },
			"/app/c/did:plc:hq",
		);
		busy = true;
		history.port.go(-1);
		route = parsePath("/app/c/did:plc:hq/manage/channel/general");
		sync.sync();
		expect(history.entries()).toHaveLength(2);
		history.flush();
		busy = false;
		for (const run of idle.splice(0)) run();
		expect(history.port.path()).toBe(
			"/app/c/did:plc:hq/manage/channel/general",
		);
		expect(depthOf(history.port.state())).toBe(1);
		history.back();
		expect(history.port.path()).toBe("/app/c/did:plc:hq");
		expect(history.index()).toBe(0);
	});

	it("never stacks channel switches", () => {
		const history = fakeHistory();
		let route: Route = parsePath("/app/c/did:plc:hq");
		const sync = createHistorySync({
			port: history.port,
			route: () => route,
			onExternal: () => {},
		});
		sync.seed(route);
		for (const channel of ["a", "b", "c"]) {
			route = parsePath(
				`/app/c/did:plc:hq/social.colibri.beta.channel.text/${channel}`,
			);
			sync.sync();
			route = parsePath("/app/c/did:plc:hq");
			sync.sync();
			history.flush();
		}
		route = parsePath("/app/c/did:plc:hq/social.colibri.beta.channel.text/d");
		sync.sync();
		expect(history.index()).toBe(1);
		expect(history.port.path()).toBe(
			"/app/c/did:plc:hq/social.colibri.beta.channel.text/d",
		);
	});

	it("pushes a same-depth switch the caller asks for and reports back as external", () => {
		const history = fakeHistory();
		const channel = (name: string) =>
			`/app/c/did:plc:hq/social.colibri.beta.channel.text/${name}`;
		let route: Route = parsePath(channel("a"));
		const onExternal = vi.fn((navigation: ExternalNavigation) => {
			route = navigation.route;
		});
		const sync = createHistorySync({
			port: history.port,
			route: () => route,
			onExternal,
			pushesSwitch: (from, to) => from !== to,
		});
		sync.seed(route);
		for (const name of ["b", "c"]) {
			route = parsePath(channel(name));
			sync.sync();
		}
		expect(history.entries().map((entry) => entry.url)).toEqual([
			"/app/c/did:plc:hq",
			channel("a"),
			channel("b"),
			channel("c"),
		]);
		expect(history.entries().map((entry) => depthOf(entry.state))).toEqual([
			0, 1, 1, 1,
		]);
		history.back();
		expect(onExternal).toHaveBeenLastCalledWith({
			route: parsePath(channel("b")),
			depth: 1,
			path: channel("b"),
		});
		history.back();
		expect(history.port.path()).toBe(channel("a"));
		route = parsePath(`${channel("a")}/t/thread`);
		sync.sync();
		route = parsePath(channel("d"));
		sync.sync();
		history.flush();
		expect(history.entries().map((entry) => entry.url)).toEqual([
			"/app/c/did:plc:hq",
			channel("a"),
			channel("d"),
		]);
	});

	it("replays a sync requested while a pop is in flight", () => {
		const history = fakeHistory();
		let route: Route = parsePath(
			"/app/c/did:plc:hq/social.colibri.beta.channel.text/a",
		);
		const sync = createHistorySync({
			port: history.port,
			route: () => route,
			onExternal: () => {},
		});
		sync.seed(route);
		route = parsePath("/app/c/did:plc:hq");
		sync.sync();
		route = parsePath("/app/c/did:plc:hq/social.colibri.beta.channel.text/b");
		sync.sync();
		history.flush();
		expect(history.port.path()).toBe(
			"/app/c/did:plc:hq/social.colibri.beta.channel.text/b",
		);
		expect(history.index()).toBe(1);
	});

	it("reports system back as an external navigation", () => {
		const history = fakeHistory();
		const route = parsePath(
			"/app/c/did:plc:hq/social.colibri.beta.channel.text/general/members",
		);
		const onExternal = vi.fn();
		const sync = createHistorySync({
			port: history.port,
			route: () => route,
			onExternal,
		});
		sync.seed(route);
		history.back();
		expect(onExternal).toHaveBeenCalledWith({
			route: parsePath(
				"/app/c/did:plc:hq/social.colibri.beta.channel.text/general",
			),
			depth: 1,
			path: "/app/c/did:plc:hq/social.colibri.beta.channel.text/general",
		});
	});

	it("updates the root entry in place when the Space changes", () => {
		const history = fakeHistory();
		let route: Route = parsePath("/app/c/did:plc:hq");
		const sync = createHistorySync({
			port: history.port,
			route: () => route,
			onExternal: () => {},
		});
		sync.seed(route);
		route = parsePath("/app/c/did:plc:owls");
		sync.sync();
		expect(history.entries()).toHaveLength(1);
		expect(history.port.path()).toBe("/app/c/did:plc:owls");
	});

	it("rewrites the base entry when a layer moves to another Space", () => {
		const history = fakeHistory();
		let route: Route = parsePath(
			"/app/c/did:plc:hq/social.colibri.beta.channel.text/general",
		);
		const sync = createHistorySync({
			port: history.port,
			route: () => route,
			onExternal: () => {},
		});
		sync.seed(route);
		route = parsePath(
			"/app/c/did:plc:owls/social.colibri.beta.channel.text/showcase",
		);
		sync.sync();
		history.flush();
		expect(history.entries().map((entry) => entry.url)).toEqual([
			"/app/c/did:plc:owls",
			"/app/c/did:plc:owls/social.colibri.beta.channel.text/showcase",
		]);
		expect(history.index()).toBe(1);
		const external = vi.fn();
		const back = createHistorySync({
			port: history.port,
			route: () => route,
			onExternal: external,
		});
		history.back();
		expect(external).toHaveBeenCalledWith({
			route: parsePath("/app/c/did:plc:owls"),
			depth: 0,
			path: "/app/c/did:plc:owls",
		});
		back.dispose();
	});

	it("layers Settings over the tab it was opened from", () => {
		const history = fakeHistory();
		let route: Route = parsePath("/app/inbox");
		const onExternal = vi.fn((navigation: ExternalNavigation) => {
			route = navigation.route;
		});
		const sync = createHistorySync({
			port: history.port,
			route: () => route,
			stacksOverTab: (root) => root.tab === "settings",
			onExternal,
		});
		sync.seed(route);
		route = parsePath("/app/settings");
		sync.sync();
		expect(history.entries().map((entry) => entry.url)).toEqual([
			"/app/inbox",
			"/app/settings",
		]);
		expect(history.index()).toBe(1);
		history.back();
		expect(history.index()).toBe(0);
		expect(onExternal).toHaveBeenCalledWith({
			route: parsePath("/app/inbox"),
			depth: 0,
			path: "/app/inbox",
		});
		sync.sync();
		expect(history.entries()).toHaveLength(2);
		expect(history.index()).toBe(0);
	});

	it("drops the Settings entry when another tab opens from it", () => {
		const history = fakeHistory();
		let route: Route = parsePath("/app/inbox");
		const sync = createHistorySync({
			port: history.port,
			route: () => route,
			stacksOverTab: (root) => root.tab === "settings",
			onExternal: () => {},
		});
		sync.seed(route);
		route = parsePath("/app/settings");
		sync.sync();
		route = parsePath("/app/profile");
		sync.sync();
		history.flush();
		expect(history.index()).toBe(0);
		expect(history.port.path()).toBe("/app/profile");
		route = parsePath("/app/settings");
		sync.sync();
		expect(history.entries().map((entry) => entry.url)).toEqual([
			"/app/profile",
			"/app/settings",
		]);
	});

	it("keeps a Settings deep link as the first entry", () => {
		const history = fakeHistory();
		const route = parsePath("/app/settings");
		const sync = createHistorySync({
			port: history.port,
			route: () => route,
			stacksOverTab: (root) => root.tab === "settings",
			onExternal: () => {},
		});
		sync.seed(route);
		sync.sync();
		expect(history.entries()).toHaveLength(1);
	});
});
