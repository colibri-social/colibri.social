import "../app.css";
import { createRoot } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";
import { createDesktopStack } from "./desktop/desktop-stack";
import type { HistoryPort } from "./history-sync";
import { LayerStack } from "./LayerStack";
import type { Layer } from "./layers";
import { createStack, type Navigator, type Stack } from "./stack";

const memoryHistory = (initial: string): HistoryPort => {
	const entries: { state: unknown; url: string }[] = [
		{ state: null, url: initial },
	];
	let index = 0;
	const listeners = new Set<() => void>();
	return {
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
			setTimeout(() => {
				index = Math.max(0, Math.min(entries.length - 1, index + delta));
				for (const listener of listeners) listener();
			});
		},
		onPop: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
};

const until = async (check: () => boolean, timeout = 3000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("timed out");
		await new Promise((resolve) => setTimeout(resolve, 16));
	}
};

const HQ = "did:plc:hq";

const profilePage: Layer = { kind: "admin", space: HQ, page: "profile" };

const depthOf = (navigator: Navigator, page: string) => () =>
	navigator
		.mounted()
		.findIndex((layer) => layer.kind === "admin" && layer.page === page) + 1;

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

const desktop = () =>
	createRoot((dispose) => {
		const stack = createDesktopStack({
			history: memoryHistory(`/app/c/${HQ}`),
			initialPath: `/app/c/${HQ}`,
		});
		cleanup = () => {
			stack.dispose();
			dispose();
		};
		return stack.navigator;
	});

describe("desktop leave guard", () => {
	it("asks before switching Spaces and replays the switch on discard", () => {
		const navigator = desktop();
		navigator.push(profilePage);
		let dirty = true;
		navigator.registerLeave({
			depth: depthOf(navigator, "profile"),
			dirty: () => dirty,
		});
		navigator.setRoot({ tab: "spaces", space: "did:plc:other" });
		expect(navigator.leaveGuard.prompting()).toBe(true);
		expect(navigator.root().space).toBe(HQ);
		expect(navigator.top()).toEqual(profilePage);
		navigator.leaveGuard.discard();
		expect(navigator.root().space).toBe("did:plc:other");
		expect(navigator.mounted()).toEqual([]);
		dirty = false;
	});

	it("keeps the page open when the person cancels", () => {
		const navigator = desktop();
		navigator.push(profilePage);
		navigator.registerLeave({
			depth: depthOf(navigator, "profile"),
			dirty: () => true,
		});
		navigator.pop();
		expect(navigator.leaveGuard.prompting()).toBe(true);
		navigator.leaveGuard.keep();
		expect(navigator.leaveGuard.prompting()).toBe(false);
		expect(navigator.top()).toEqual(profilePage);
	});

	it("runs a whole guarded action after one confirmation", () => {
		const navigator = desktop();
		navigator.push({ kind: "admin", space: HQ, page: "overview" });
		navigator.push(profilePage);
		navigator.registerLeave({
			depth: depthOf(navigator, "profile"),
			dirty: () => true,
		});
		const roles: Layer = { kind: "admin", space: HQ, page: "roles" };
		navigator.confirmLeave(1, () => {
			navigator.popTo(1);
			navigator.push(roles);
		});
		expect(navigator.top()).toEqual(profilePage);
		navigator.leaveGuard.discard();
		expect(navigator.top()).toEqual(roles);
		expect(navigator.leaveGuard.prompting()).toBe(false);
	});

	it("ignores pages that the navigation leaves in place", () => {
		const navigator = desktop();
		navigator.push({ kind: "admin", space: HQ, page: "roles" });
		navigator.push({ kind: "admin", space: HQ, page: "role", id: "mods" });
		navigator.registerLeave({
			depth: depthOf(navigator, "roles"),
			dirty: () => true,
		});
		navigator.pop();
		expect(navigator.leaveGuard.prompting()).toBe(false);
		expect(navigator.mounted()).toHaveLength(1);
	});
});

describe("mobile leave guard", () => {
	const mobile = () => {
		const host = document.createElement("div");
		host.style.cssText = "position:fixed;inset:0;width:402px;height:874px";
		document.body.append(host);
		let stack: Stack | undefined;
		const dispose = render(() => {
			stack = createStack({
				history: memoryHistory("/app/settings"),
				initialPath: "/app/settings",
				forward: () => undefined,
			});
			return (
				<LayerStack
					stack={stack}
					base={<div>Base</div>}
					renderLayer={(layer) => <div>{layer.kind}</div>}
				/>
			);
		}, host);
		cleanup = () => {
			dispose();
			host.remove();
		};
		return stack as Stack;
	};

	it("stops asking about a discarded page once it is parked", async () => {
		const stack = mobile();
		stack.push({ kind: "createSpace" });
		await until(() => stack.activeDepth() === 1 && !stack.moving());
		stack.push({ kind: "editProfile" });
		await until(() => stack.activeDepth() === 2 && !stack.moving());
		stack.registerLeave({
			depth: () =>
				stack.mounted().findIndex((layer) => layer.kind === "editProfile") + 1,
			dirty: () => true,
		});
		stack.pop();
		expect(stack.leaveGuard.prompting()).toBe(true);
		expect(stack.depth()).toBe(2);
		stack.leaveGuard.discard();
		await until(() => stack.depth() === 1 && !stack.moving());
		expect(stack.mounted()).toHaveLength(2);
		stack.pop();
		expect(stack.leaveGuard.prompting()).toBe(false);
		await until(() => stack.depth() === 0 && !stack.moving());
	});
});
