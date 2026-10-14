import "../app.css";
import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";
import type { HistoryPort } from "./history-sync";
import { LayerStack } from "./LayerStack";
import type { Layer } from "./layers";
import { createStack, type Stack } from "./stack";

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
});

const mount = (path = "/app/c/did:plc:hq") => {
	host = document.createElement("div");
	host.style.cssText = "position:fixed;inset:0;width:402px;height:874px";
	document.body.append(host);
	const history = memoryHistory(path);
	let stack: Stack | undefined;
	dispose = render(() => {
		stack = createStack({
			history,
			initialPath: path,
			forward: (top) =>
				top?.kind === "chat"
					? { kind: "members", space: top.space, channel: top.channel }
					: undefined,
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
