import "../app.css";
import { createRoot, createSignal } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Did, SpaceRef } from "../data/types";
import { openNotificationTarget } from "../screens/inbox/inbox-adapter";
import { createDesktopStack } from "./desktop/desktop-stack";
import type { HistoryPort } from "./history-sync";
import { LayerStack } from "./LayerStack";
import { type Layer, pathAt, type ThreadLayer } from "./layers";
import { createStack, type Stack } from "./stack";
import { canSwipeForward, membersForward } from "./swipe-forward";

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

const HQ = "did:plc:hq";
const TEXT = "social.colibri.beta.channel.text";
const CHANNEL = `at://${HQ}/space/${TEXT}/general` as SpaceRef;
const THREAD = `at://${HQ}/space/social.colibri.beta.thread/t1` as SpaceRef;

const thread: ThreadLayer = {
	kind: "thread",
	space: HQ,
	channel: "general",
	channelType: TEXT,
	thread: "t1",
};

const target = {
	community: HQ as Did,
	channel: CHANNEL,
	thread: THREAD,
	message: { rkey: "m1" },
};

let dispose: (() => void) | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
	dispose?.();
	dispose = undefined;
	host?.remove();
});

const until = async (check: () => boolean, timeout = 3000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("timed out");
		await new Promise((resolve) => requestAnimationFrame(resolve));
	}
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const mountMobile = (
	path: string,
	options: { swipeLeftAction?: "members" | "reply" } = {},
) => {
	host = document.createElement("div");
	host.style.cssText = "position:fixed;inset:0;width:402px;height:874px";
	document.body.append(host);
	const history = memoryHistory(path);
	let stack: Stack | undefined;
	dispose = render(() => {
		stack = createStack({
			history,
			initialPath: path,
			canForward: (top) =>
				canSwipeForward(top, {
					selecting: false,
					swipeLeftAction: options.swipeLeftAction ?? "members",
				}),
			forward: membersForward,
		});
		return (
			<LayerStack
				stack={stack}
				base={<div data-testid="base">Base</div>}
				renderLayer={(layer) => (
					<div data-testid={layer.kind}>{layer.kind}</div>
				)}
			/>
		);
	}, host);
	return { stack: stack as Stack, history, root: host };
};

const settledAt = (stack: Stack, depth: number) => () =>
	!stack.moving() && stack.activeDepth() === depth;

const pointer = (target: Element, type: string, x: number, y: number) =>
	target.dispatchEvent(
		new PointerEvent(type, {
			pointerId: 7,
			pointerType: "touch",
			isPrimary: true,
			clientX: x,
			clientY: y,
			bubbles: true,
			cancelable: true,
		}),
	);

const swipeLeft = async (root: HTMLElement) => {
	const surface = root.querySelector("[data-pane-stack]") as HTMLElement;
	pointer(surface, "pointerdown", 360, 400);
	let x = 360;
	for (let index = 0; index < 12; index++) {
		x = 360 - 12 - index * 22;
		pointer(surface, "pointermove", x, 400);
		await wait(8);
	}
	await wait(120);
	pointer(document.body, "pointerup", x, 400);
};

describe("opening a notification on mobile", () => {
	it("puts the thread straight over the channel list", async () => {
		const { stack, history } = mountMobile(
			`/app/c/${HQ}/${TEXT}/general/members`,
		);
		await until(settledAt(stack, 2));
		stack.push({ ...thread, thread: "older" });
		await until(settledAt(stack, 3));
		const requestJump = vi.fn();
		openNotificationTarget(stack, requestJump, target);
		await until(settledAt(stack, 1));
		await wait(60);
		expect(stack.mounted().slice(0, stack.depth())).toEqual([thread]);
		expect(stack.root()).toEqual({ tab: "spaces", space: HQ });
		expect(requestJump).toHaveBeenCalledWith({ channel: THREAD, rkey: "m1" });
		expect(history.path()).toBe(
			pathAt({ root: stack.root(), layers: [thread] }, 1),
		);
		stack.pop();
		await until(settledAt(stack, 0));
		await wait(60);
		expect(history.path()).toBe(`/app/c/${HQ}`);
	});

	it("opens only the chat for a channel notification", async () => {
		const { stack } = mountMobile(`/app/c/${HQ}`);
		openNotificationTarget(stack, () => {}, {
			community: HQ as Did,
			channel: CHANNEL,
		});
		await until(settledAt(stack, 1));
		expect(stack.mounted().slice(0, stack.depth())).toEqual([
			{ kind: "chat", space: HQ, channel: "general", channelType: TEXT },
		]);
	});

	it("asks before dropping unsaved changes and opens the thread on discard", async () => {
		const { stack } = mountMobile(`/app/c/${HQ}/${TEXT}/general`);
		await until(settledAt(stack, 1));
		const draft: Layer = { kind: "admin", space: HQ, page: "profile" };
		stack.push(draft);
		await until(settledAt(stack, 2));
		stack.registerLeave({ depth: () => 2, dirty: () => true });
		openNotificationTarget(stack, () => {}, target);
		expect(stack.leaveGuard.prompting()).toBe(true);
		expect(stack.top()).toEqual(draft);
		stack.leaveGuard.discard();
		await until(settledAt(stack, 1));
		expect(stack.top()).toEqual(thread);
	});

	it("keeps everything in place when the person stays", async () => {
		const { stack } = mountMobile(`/app/c/${HQ}/${TEXT}/general`);
		await until(settledAt(stack, 1));
		const draft: Layer = { kind: "admin", space: HQ, page: "profile" };
		stack.push(draft);
		await until(settledAt(stack, 2));
		stack.registerLeave({ depth: () => 2, dirty: () => true });
		openNotificationTarget(stack, () => {}, target);
		stack.leaveGuard.keep();
		await wait(100);
		expect(stack.depth()).toBe(2);
		expect(stack.top()).toEqual(draft);
	});
});

describe("opening a notification on desktop", () => {
	it("opens the channel with the thread pane", () => {
		createRoot((done) => {
			const desktop = createDesktopStack({
				history: memoryHistory(`/app/c/${HQ}`),
				initialPath: `/app/c/${HQ}`,
			});
			dispose = () => {
				desktop.dispose();
				done();
			};
			const [open, setOpen] = createSignal<boolean>();
			openNotificationTarget(desktop.navigator, () => {}, target, {
				setVoiceChatOpen: setOpen,
			});
			expect(desktop.route().chat).toMatchObject({
				kind: "chat",
				space: HQ,
				channel: "general",
			});
			expect(desktop.route().pane).toMatchObject({
				kind: "thread",
				thread: "t1",
			});
			expect(open()).toBeUndefined();
		});
	});
});

describe("swiping to members", () => {
	it("pulls in the thread's members from a thread", async () => {
		const { stack, root } = mountMobile(`/app/c/${HQ}`);
		stack.push(thread);
		await until(settledAt(stack, 1));
		await swipeLeft(root);
		await until(settledAt(stack, 2));
		expect(stack.top()).toEqual({
			kind: "members",
			space: HQ,
			channel: "general",
			thread: "t1",
		});
	});

	it("leaves the swipe to replies when that's the chosen action", async () => {
		const { stack, root } = mountMobile(`/app/c/${HQ}`, {
			swipeLeftAction: "reply",
		});
		stack.push(thread);
		await until(settledAt(stack, 1));
		await swipeLeft(root);
		await wait(400);
		expect(stack.depth()).toBe(1);
		expect(stack.top()).toEqual(thread);
	});
});
