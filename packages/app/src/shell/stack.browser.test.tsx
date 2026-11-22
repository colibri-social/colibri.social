import "../app.css";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";
import type { SpaceData } from "../data/store";
import type { CategoryView, ChannelView, CommunityView } from "../data/types";
import type { HistoryPort } from "./history-sync";
import { LayerStack } from "./LayerStack";
import { type Layer, layerPath, type Root } from "./layers";
import { createStack, type Stack } from "./stack";
import { type ForwardData, swipeForward } from "./swipe-forward";

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

const chat: Layer = {
	kind: "chat",
	space: "did:plc:hq",
	channel: "general",
	channelType: "social.colibri.beta.channel.text",
};

let dispose: (() => void) | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
	dispose?.();
	host?.remove();
	delete document.documentElement.dataset.reducedMotion;
	delete document.documentElement.dataset.slowMotion;
});

type Forward = (top: Layer | undefined, root: Root) => Layer | undefined;

const membersOnly: Forward = (top) => {
	return top?.kind === "chat"
		? { kind: "members", space: top.space, channel: top.channel }
		: undefined;
};

const mount = (
	path = "/app/c/did:plc:hq",
	width = "402px",
	forward: Forward = membersOnly,
) => {
	host = document.createElement("div");
	host.style.cssText = `position:fixed;inset:0;width:${width};height:874px`;
	document.body.append(host);
	const history = memoryHistory(path);
	let stack: Stack | undefined;
	dispose = render(() => {
		stack = createStack({
			history,
			initialPath: path,
			forward,
		});
		return (
			<LayerStack
				stack={stack}
				base={<div data-testid="base">Base</div>}
				renderLayer={(layer) => (
					<div data-testid={layer.kind} data-path={layerPath(layer)}>
						{layer.kind}
					</div>
				)}
			/>
		);
	}, host);
	return { stack: stack as Stack, history, root: host };
};

const frame = (root: HTMLElement, index: number) =>
	root.querySelector<HTMLElement>(
		`[data-pane-index="${index}"]`,
	) as HTMLElement;

const stackRoot = (root: HTMLElement) =>
	root.querySelector<HTMLElement>("[data-pane-stack]") as HTMLElement;

const translateX = (element: HTMLElement) => {
	const match = /translate3d\((-?[\d.]+)px/.exec(element.style.transform);
	return match ? Number(match[1]) : 0;
};

const until = async (check: () => boolean, timeout = 2000) => {
	const start = performance.now();
	while (!check()) {
		if (performance.now() - start > timeout) throw new Error("Timed out");
		await new Promise((resolve) => requestAnimationFrame(resolve));
	}
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const pointer = (
	target: Element,
	type: string,
	x: number,
	y: number,
	pointerId = 7,
) =>
	target.dispatchEvent(
		new PointerEvent(type, {
			pointerId,
			pointerType: "touch",
			isPrimary: true,
			clientX: x,
			clientY: y,
			bubbles: true,
			cancelable: true,
		}),
	);

const drag = async (
	target: Element,
	from: { x: number; y: number },
	steps: { dx: number; dy?: number }[],
	options: { restBeforeRelease?: number; stepMs?: number } = {},
) => {
	pointer(target, "pointerdown", from.x, from.y);
	let last = from;
	for (const step of steps) {
		last = { x: from.x + step.dx, y: from.y + (step.dy ?? 0) };
		pointer(target, "pointermove", last.x, last.y);
		await wait(options.stepMs ?? 8);
	}
	if (options.restBeforeRelease) await wait(options.restBeforeRelease);
	pointer(window.document.body, "pointerup", last.x, last.y);
};

const settledAt = (stack: Stack, depth: number) => () =>
	!stack.moving() && stack.activeDepth() === depth;

describe("layered stack", () => {
	it("pushes a layer over the base and hides what it covers from assistive tech", async () => {
		const { stack, root } = mount();
		stack.push(chat);
		await until(settledAt(stack, 1));
		expect(frame(root, 1).style.transform).toBe("");
		expect(frame(root, 0).style.transform).toBe("");
		expect(frame(root, 0).style.visibility).toBe("");
		expect(frame(root, 0).getAttribute("aria-hidden")).toBe("true");
		expect(frame(root, 0).hasAttribute("data-pane-active")).toBe(false);
	});

	it("parks the popped pane fully outside a fractional-width stack", async () => {
		const { stack, root } = mount(
			"/app/c/did:plc:hq/social.colibri.beta.channel.text/general",
			"402.4px",
		);
		await until(() => !!frame(root, 1));
		stack.pop();
		await until(settledAt(stack, 0));
		const parked = frame(root, 1);
		expect(parked.style.visibility).toBe("");
		expect(parked.getBoundingClientRect().left).toBeGreaterThanOrEqual(
			stackRoot(root).getBoundingClientRect().right + 1,
		);
	});

	it("ignores taps on the pane that is leaving while layers move", async () => {
		const { stack, root } = mount();
		let clicks = 0;
		const base = root.querySelector<HTMLElement>('[data-testid="base"]');
		base?.addEventListener("click", () => clicks++);
		stack.push(chat);
		expect(stack.moving()).toBe(true);
		base?.click();
		expect(clicks).toBe(0);
		await until(settledAt(stack, 1));
	});

	it("blurs focus left in a pane that gets covered", async () => {
		const { stack, root } = mount();
		stack.push(chat);
		await until(settledAt(stack, 1));
		const field = document.createElement("input");
		root.querySelector('[data-testid="chat"]')?.append(field);
		field.focus();
		expect(document.activeElement).toBe(field);
		stack.push({ ...chat, kind: "members" } as Layer);
		await until(settledAt(stack, 2));
		expect(document.activeElement).not.toBe(field);
	});

	it("follows the finger while the list stays in place", async () => {
		const { stack, root } = mount(
			"/app/c/did:plc:hq/social.colibri.beta.channel.text/general",
		);
		await until(() => !!frame(root, 1));
		const surface = stackRoot(root);
		pointer(surface, "pointerdown", 100, 400);
		pointer(surface, "pointermove", 112, 400);
		pointer(surface, "pointermove", 212, 400);
		await new Promise((resolve) => requestAnimationFrame(resolve));
		await new Promise((resolve) => requestAnimationFrame(resolve));
		expect(translateX(frame(root, 1))).toBeCloseTo(100, 0);
		expect(frame(root, 0).style.transform).toBe("");
		expect(frame(root, 0).style.visibility).toBe("");
		expect(frame(root, 1).style.willChange).toBe("transform");
		pointer(document.body, "pointercancel", 212, 400);
		await until(settledAt(stack, 1));
	});

	it("returns to the chat when the system cancels a drag toward members", async () => {
		const { stack, root, history } = mount(
			"/app/c/did:plc:hq/social.colibri.beta.channel.text/general",
		);
		await until(() => !!frame(root, 1));
		const surface = stackRoot(root);
		pointer(surface, "pointerdown", 380, 400);
		pointer(surface, "pointermove", 368, 400);
		for (let x = 340; x >= 60; x -= 40) {
			pointer(surface, "pointermove", x, 400);
			await new Promise((resolve) => requestAnimationFrame(resolve));
		}
		pointer(document.body, "pointercancel", 0, 0);
		await until(settledAt(stack, 1));
		await wait(20);
		expect(history.path()).toBe(
			"/app/c/did:plc:hq/social.colibri.beta.channel.text/general",
		);
		expect(stack.activeDepth()).toBe(1);
	});

	it("goes back after a slow drag past halfway", async () => {
		const { stack, root, history } = mount(
			"/app/c/did:plc:hq/social.colibri.beta.channel.text/general",
		);
		await until(() => !!frame(root, 1));
		await drag(
			stackRoot(root),
			{ x: 40, y: 400 },
			Array.from({ length: 12 }, (_, index) => ({ dx: 12 + index * 22 })),
			{ restBeforeRelease: 120 },
		);
		await until(settledAt(stack, 0));
		await wait(20);
		expect(history.path()).toBe("/app/c/did:plc:hq");
		expect(frame(root, 0).style.transform).toBe("");
	});

	it("stays after a slow short drag", async () => {
		const { stack, root } = mount(
			"/app/c/did:plc:hq/social.colibri.beta.channel.text/general",
		);
		await until(() => !!frame(root, 1));
		await drag(
			stackRoot(root),
			{ x: 40, y: 400 },
			[{ dx: 12 }, { dx: 40 }, { dx: 80 }],
			{ restBeforeRelease: 120 },
		);
		await until(settledAt(stack, 1));
		expect(frame(root, 1).style.transform).toBe("");
	});

	it("goes back on a short fast flick", async () => {
		const { stack, root } = mount(
			"/app/c/did:plc:hq/social.colibri.beta.channel.text/general",
		);
		await until(() => !!frame(root, 1));
		await drag(
			stackRoot(root),
			{ x: 40, y: 400 },
			[{ dx: 12 }, { dx: 40 }, { dx: 80 }, { dx: 130 }],
			{ stepMs: 10 },
		);
		await until(settledAt(stack, 0));
	});

	it("ignores vertical drags", async () => {
		const { stack, root } = mount(
			"/app/c/did:plc:hq/social.colibri.beta.channel.text/general",
		);
		await until(() => !!frame(root, 1));
		await drag(stackRoot(root), { x: 100, y: 400 }, [
			{ dx: 4, dy: 20 },
			{ dx: 30, dy: 120 },
		]);
		await wait(50);
		expect(stack.activeDepth()).toBe(1);
		expect(frame(root, 1).style.transform).toBe("");
	});

	it("pulls the next layer in with a forward swipe", async () => {
		const { stack, root, history } = mount(
			"/app/c/did:plc:hq/social.colibri.beta.channel.text/general",
		);
		await until(() => !!frame(root, 1));
		await drag(
			stackRoot(root),
			{ x: 360, y: 400 },
			Array.from({ length: 12 }, (_, index) => ({ dx: -12 - index * 22 })),
			{ restBeforeRelease: 120 },
		);
		await until(settledAt(stack, 2));
		await wait(20);
		expect(root.querySelector('[data-testid="members"]')).not.toBeNull();
		expect(history.path()).toBe(
			"/app/c/did:plc:hq/social.colibri.beta.channel.text/general/members",
		);
		expect(frame(root, 0).style.visibility).toBe("hidden");
		expect(frame(root, 1).hasAttribute("data-pane-active")).toBe(false);
	});

	it("catches a layer mid-flight and resumes when released", async () => {
		const { stack, root } = mount();
		stack.push(chat);
		await wait(60);
		const caught = translateX(frame(root, 1));
		expect(caught).toBeGreaterThan(0);
		pointer(stackRoot(root), "pointerdown", 200, 400);
		await wait(60);
		expect(translateX(frame(root, 1))).toBeCloseTo(caught, 0);
		pointer(document.body, "pointerup", 200, 400);
		await until(settledAt(stack, 1));
	});

	it("pops one layer on system back", async () => {
		const { stack, root, history } = mount(
			"/app/c/did:plc:hq/social.colibri.beta.channel.text/general/members",
		);
		await until(() => !!frame(root, 2));
		history.go(-1);
		await until(settledAt(stack, 1));
		expect(history.path()).toBe(
			"/app/c/did:plc:hq/social.colibri.beta.channel.text/general",
		);
	});
});

describe("taps after a swipe", () => {
	it("lets the first tap on the new layer through", async () => {
		const { stack, root } = mount(
			"/app/c/did:plc:hq/social.colibri.beta.channel.text/general",
		);
		await until(() => !!frame(root, 1));
		await drag(
			stackRoot(root),
			{ x: 360, y: 400 },
			Array.from({ length: 12 }, (_, index) => ({ dx: -12 - index * 22 })),
			{ restBeforeRelease: 120 },
		);
		await wait(150);
		const target = root.querySelector('[data-testid="members"]') as HTMLElement;
		let clicks = 0;
		target.addEventListener("click", () => {
			clicks += 1;
		});
		pointer(target, "pointerdown", 100, 300);
		pointer(document.body, "pointerup", 100, 300);
		target.click();
		expect(clicks).toBe(1);
		await until(settledAt(stack, 2));
	});

	it("stops the browser turning a horizontal pan into a fling", async () => {
		const { root } = mount(
			"/app/c/did:plc:hq/social.colibri.beta.channel.text/general",
		);
		await until(() => !!frame(root, 1));
		const target = stackRoot(root);
		const touchMove = () => {
			const event = new TouchEvent("touchmove", {
				bubbles: true,
				cancelable: true,
			});
			target.dispatchEvent(event);
			return event.defaultPrevented;
		};
		pointer(target, "pointerdown", 360, 400);
		pointer(target, "pointermove", 362, 440);
		expect(touchMove()).toBe(false);
		pointer(document.body, "pointerup", 362, 440);
		window.dispatchEvent(new TouchEvent("touchend", { bubbles: true }));

		pointer(target, "pointerdown", 360, 400);
		expect(touchMove()).toBe(false);
		pointer(target, "pointermove", 330, 401);
		expect(touchMove()).toBe(true);
		pointer(document.body, "pointerup", 300, 401);
		window.dispatchEvent(new TouchEvent("touchend", { bubbles: true }));
		expect(touchMove()).toBe(false);
	});
});

describe("system back through layers a URL can't rebuild", () => {
	it("steps back one layer when the URL matches what's mounted", async () => {
		const { stack, history } = mount();
		const settings: Layer = {
			kind: "admin",
			space: "did:plc:hq",
			page: "channel",
			id: "general",
		};
		const permissions: Layer = {
			kind: "admin",
			space: "did:plc:hq",
			page: "channel-permissions",
			id: "general",
		};
		const audience: Layer = {
			kind: "admin",
			space: "did:plc:hq",
			page: "channel-audience",
			id: "general~visible",
		};
		stack.push(settings);
		await until(settledAt(stack, 1));
		stack.push(permissions);
		await until(settledAt(stack, 2));
		stack.push(audience);
		await until(settledAt(stack, 3));
		history.go(-1);
		await wait(50);
		await until(() => !stack.moving());
		expect(stack.depth()).toBe(2);
		expect(stack.top()).toEqual(permissions);
		expect(stack.mounted()[0]).toEqual(settings);
	});
});

describe("swiping back while a layer moves in", () => {
	const members: Layer = {
		kind: "members",
		space: "did:plc:hq",
		channel: "general",
		channelType: "social.colibri.beta.channel.text",
	};

	for (const delay of [0, 60]) {
		it(`only dismisses the incoming layer on a system back (${delay}ms after the push)`, async () => {
			const { stack, history } = mount();
			stack.push(chat);
			await until(settledAt(stack, 1));
			stack.push(members);
			if (delay) await wait(delay);
			history.go(-1);
			await wait(50);
			await until(() => !stack.moving());
			await wait(100);
			expect(stack.depth()).toBe(1);
			expect(stack.top()?.kind).toBe("chat");
			expect(history.path()).toBe(
				"/app/c/did:plc:hq/social.colibri.beta.channel.text/general",
			);
		});

		it(`only dismisses the incoming layer (${delay}ms after the push)`, async () => {
			const { stack, root } = mount();
			stack.push(chat);
			await until(settledAt(stack, 1));
			stack.push(members);
			if (delay) await wait(delay);
			await drag(stackRoot(root), { x: 20, y: 400 }, [
				{ dx: 40 },
				{ dx: 120 },
				{ dx: 240 },
				{ dx: 360 },
			]);
			await until(() => !stack.moving());
			await wait(100);
			expect(stack.depth()).toBe(1);
			expect(stack.top()?.kind).toBe("chat");
		});
	}
});

describe("sheet layers", () => {
	const settings: Layer = {
		kind: "admin",
		space: "did:plc:hq",
		page: "overview",
	};
	const translateY = (element: HTMLElement) => {
		const match = /translate3d\(0(?:px)?,\s*(-?[\d.]+)px/.exec(
			element.style.transform,
		);
		return match ? Number(match[1]) : 0;
	};

	it("rises from the bottom and rests in place", async () => {
		const { stack, root } = mount();
		stack.push(settings);
		await until(() => !!frame(root, 1));
		const sheet = frame(root, 1);
		expect(sheet.hasAttribute("data-pane-sheet")).toBe(true);
		const seen: string[] = [];
		await until(() => {
			seen.push(sheet.style.transform);
			return !stack.moving();
		});
		expect(
			seen.some((value) => /translate3d\(0(px)?,\s*[1-9]/.test(value)),
		).toBe(true);
		expect(translateX(sheet)).toBe(0);
		expect(sheet.style.transform).toBe("");
	});

	it("slides away on a back swipe", async () => {
		const { stack, root } = mount();
		stack.push(settings);
		await until(() => !!frame(root, 1) && !stack.moving());
		const sheet = frame(root, 1);
		pointer(stackRoot(root), "pointerdown", 20, 400);
		pointer(stackRoot(root), "pointermove", 80, 400);
		pointer(stackRoot(root), "pointermove", 180, 400);
		expect(translateX(sheet)).toBeGreaterThan(50);
		expect(translateY(sheet)).toBe(0);
		pointer(stackRoot(root), "pointermove", 320, 400);
		pointer(stackRoot(root), "pointerup", 320, 400);
		await until(() => !stack.moving());
		expect(stack.depth()).toBe(0);
	});

	it("dismisses on a downward drag from the header", async () => {
		const { stack, root } = mount();
		stack.push(settings);
		await until(() => !!frame(root, 1) && !stack.moving());
		const sheet = frame(root, 1);
		pointer(sheet, "pointerdown", 200, 30, 9);
		for (const y of [50, 120, 260, 420, 600]) {
			pointer(sheet, "pointermove", 200, y, 9);
			await new Promise((resolve) => requestAnimationFrame(resolve));
		}
		expect(translateY(sheet)).toBeGreaterThan(300);
		pointer(sheet, "pointerup", 200, 600, 9);
		await until(() => !stack.moving());
		expect(stack.depth()).toBe(0);
	});

	it("keeps the sheet when the drag starts below the header", async () => {
		const { stack, root } = mount();
		stack.push(settings);
		await until(() => !!frame(root, 1) && !stack.moving());
		const sheet = frame(root, 1);
		pointer(sheet, "pointerdown", 200, 400);
		for (const y of [430, 500, 600]) pointer(sheet, "pointermove", 200, y, 9);
		pointer(sheet, "pointerup", 200, 600);
		await wait(300);
		expect(stack.depth()).toBe(1);
		expect(sheet.style.transform).toBe("");
	});
});

const HQ = "did:plc:hq";
const LAB = "did:plc:lab";
const TEXT = "social.colibri.beta.channel.text";
const VOICE = "social.colibri.beta.channel.voice";

const channelView = (
	space: string,
	slug: string,
	type = TEXT,
	category?: string,
) => {
	return {
		space: `at://${space}/space/${type}/${slug}`,
		type,
		name: slug,
		category,
	} as unknown as ChannelView;
};

type FakeSpace = {
	channels: ChannelView[];
	categories?: CategoryView[];
	last?: string;
};

const fakeData = (spaces: Record<string, FakeSpace>) => {
	const data: ForwardData = {
		spaceByKey: (key: string) =>
			spaces[key] ? ({ did: key } as CommunityView) : undefined,
		space: (community: CommunityView) =>
			({
				channels: { value: () => spaces[community.did]?.channels },
				categories: { value: () => spaces[community.did]?.categories },
			}) as unknown as SpaceData,
		lastChannel: (key: string) => spaces[key]?.last,
	};

	return data;
};

const twoSpaces = () => {
	return fakeData({
		[HQ]: { channels: [channelView(HQ, "general")], last: "general" },
		[LAB]: {
			channels: [channelView(LAB, "lobby"), channelView(LAB, "design")],
			last: "design",
		},
	});
};

const chatPath = (space: string, slug: string, type = TEXT) => {
	return `/app/c/${space}/${type}/${slug}`;
};

const swipeForwardOn = (root: HTMLElement) => {
	return drag(
		stackRoot(root),
		{ x: 360, y: 400 },
		Array.from({ length: 12 }, (_, index) => ({ dx: -12 - index * 22 })),
		{ restBeforeRelease: 120 },
	);
};

const openChat = (root: HTMLElement) => {
	return root.querySelector<HTMLElement>('[data-testid="chat"]');
};

describe("forward swipe from the channel list", () => {
	it("opens the last channel of the Space you switched to", async () => {
		const { stack, root, history } = mount(
			`/app/c/${HQ}`,
			"402px",
			swipeForward(twoSpaces()),
		);
		await swipeForwardOn(root);
		await until(settledAt(stack, 1));
		stack.pop();
		await until(settledAt(stack, 0));
		expect(openChat(root)?.dataset.path).toBe(chatPath(HQ, "general"));
		stack.setRoot({ tab: "spaces", space: LAB });
		await swipeForwardOn(root);
		await until(settledAt(stack, 1));
		expect(stack.top()).toEqual({
			kind: "chat",
			space: LAB,
			channel: "design",
			channelType: TEXT,
		});
		expect(openChat(root)?.dataset.path).toBe(chatPath(LAB, "design"));
		expect(history.path()).toBe(chatPath(LAB, "design"));
	});

	it("opens the topmost text channel when the last one is gone or isn't text", async () => {
		const data = fakeData({
			[LAB]: {
				channels: [
					channelView(LAB, "hangout", VOICE),
					channelView(LAB, "news", TEXT, "c1"),
					channelView(LAB, "lobby"),
				],
				categories: [
					{
						rkey: "c1",
						name: "Updates",
						channels: [channelView(LAB, "news", TEXT, "c1")],
					} as unknown as CategoryView,
				],
				last: "hangout",
			},
		});
		const { stack, root } = mount(`/app/c/${LAB}`, "402px", swipeForward(data));
		await swipeForwardOn(root);
		await until(settledAt(stack, 1));
		expect(openChat(root)?.dataset.path).toBe(chatPath(LAB, "lobby"));
	});

	it("opens the first channel in a category when nothing sits above it", async () => {
		const data = fakeData({
			[LAB]: {
				channels: [
					channelView(LAB, "hangout", VOICE, "c1"),
					channelView(LAB, "news", TEXT, "c1"),
				],
				categories: [
					{
						rkey: "c1",
						name: "Updates",
						channels: [
							channelView(LAB, "hangout", VOICE, "c1"),
							channelView(LAB, "news", TEXT, "c1"),
						],
					} as unknown as CategoryView,
				],
			},
		});
		const { stack, root } = mount(`/app/c/${LAB}`, "402px", swipeForward(data));
		await swipeForwardOn(root);
		await until(settledAt(stack, 1));
		expect(openChat(root)?.dataset.path).toBe(chatPath(LAB, "news"));
	});

	it("has no forward swipe in a Space without text channels", async () => {
		const data = fakeData({
			[LAB]: { channels: [channelView(LAB, "hangout", VOICE)] },
		});
		const { stack, root } = mount(`/app/c/${LAB}`, "402px", swipeForward(data));
		await swipeForwardOn(root);
		await wait(150);
		expect(stack.activeDepth()).toBe(0);
		expect(stack.mounted()).toEqual([]);
	});

	it("opens the new Space's channel after creating a Space", async () => {
		const { stack, root } = mount(
			"/app/new",
			"402px",
			swipeForward(twoSpaces()),
		);
		await until(() => !!root.querySelector('[data-testid="createSpace"]'));
		stack.setRoot({ tab: "spaces", space: LAB });
		stack.popTo(0);
		await until(settledAt(stack, 0));
		expect(root.querySelector('[data-testid="createSpace"]')).toBeNull();
		await swipeForwardOn(root);
		await until(settledAt(stack, 1));
		expect(root.querySelector('[data-testid="createSpace"]')).toBeNull();
		expect(openChat(root)?.dataset.path).toBe(chatPath(LAB, "design"));
	});

	it("reuses a parked chat of the same channel without remounting it", async () => {
		const { stack, root } = mount(
			`/app/c/${HQ}`,
			"402px",
			swipeForward(twoSpaces()),
		);
		stack.push({
			kind: "chat",
			space: HQ,
			channel: "general",
			channelType: TEXT,
		});
		await until(settledAt(stack, 1));
		const parked = openChat(root);
		stack.pop();
		await until(settledAt(stack, 0));
		expect(parked?.isConnected).toBe(true);
		await swipeForwardOn(root);
		await until(settledAt(stack, 1));
		expect(openChat(root)).toBe(parked);
	});

	it("doesn't re-enter a settings page you backed out of", async () => {
		const { stack, root } = mount(
			"/app/settings",
			"402px",
			swipeForward(twoSpaces()),
		);
		stack.push({ kind: "settings", page: "appearance" });
		await until(settledAt(stack, 1));
		stack.pop();
		await until(settledAt(stack, 0));
		await swipeForwardOn(root);
		await wait(150);
		expect(stack.activeDepth()).toBe(0);
		expect(stack.top()).toBeUndefined();
	});

	it("opens nothing on the settings tab after leaving a chat", async () => {
		const { stack, root } = mount(
			`/app/c/${HQ}`,
			"402px",
			swipeForward(twoSpaces()),
		);
		stack.push({
			kind: "chat",
			space: HQ,
			channel: "general",
			channelType: TEXT,
		});
		await until(settledAt(stack, 1));
		stack.pop();
		await until(settledAt(stack, 0));
		stack.setRoot({ tab: "settings" });
		expect(stack.mounted()).toEqual([]);
		await swipeForwardOn(root);
		await wait(150);
		expect(stack.activeDepth()).toBe(0);
		expect(openChat(root)).toBeNull();
	});
});

describe("pane motion settings", () => {
	it("snaps a released swipe to its target with reduced motion", async () => {
		document.documentElement.dataset.reducedMotion = "true";
		const { stack, root } = mount(chatPath(HQ, "general"));
		await until(() => !!frame(root, 1));
		await swipeForwardOn(root);
		expect(stack.moving()).toBe(false);
		expect(stack.activeDepth()).toBe(2);
		expect(frame(root, 2).style.transform).toBe("");
		expect(frame(root, 2).getAnimations()).toHaveLength(0);
	});

	it("follows the finger during a drag with reduced motion", async () => {
		document.documentElement.dataset.reducedMotion = "true";
		const { root } = mount(chatPath(HQ, "general"));
		await until(() => !!frame(root, 1));
		const surface = stackRoot(root);
		pointer(surface, "pointerdown", 360, 400);
		for (const dx of [-12, -40, -80, -120]) {
			pointer(surface, "pointermove", 360 + dx, 400);
			await wait(8);
		}
		const offset = translateX(frame(root, 2));
		expect(offset).toBeGreaterThan(0);
		expect(offset).toBeLessThan(402);
		pointer(document.body, "pointerup", 240, 400);
	});

	it("fades a tapped layer in with reduced motion", async () => {
		document.documentElement.dataset.reducedMotion = "true";
		const { stack, root } = mount();
		stack.push(chat);
		await until(settledAt(stack, 1));
		expect(frame(root, 1).style.transform).toBe("");
		expect(frame(root, 1).getAnimations()).toHaveLength(1);
	});

	it("stretches the pane spring by the motion scale", async () => {
		document.documentElement.dataset.slowMotion = "true";
		const { stack } = mount();
		stack.push(chat);
		await wait(900);
		expect(stack.moving()).toBe(true);
		await until(settledAt(stack, 1), 6000);
	});
});
