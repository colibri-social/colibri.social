// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { anchoredScrollTop, captureAnchor } from "./message-scroll";
import { createDomScrollSurface } from "./message-scroll-dom";

type RowSpec = { uri?: string; height: number };

const CLIENT_HEIGHT = 600;

const makeSpecs = (prefix: string, count: number, height: number): RowSpec[] =>
	Array.from({ length: count }, (_, index) => ({
		uri: `at://${prefix}-${index}`,
		height,
	}));

const define = (element: HTMLElement, values: Record<string, number>): void => {
	for (const [name, value] of Object.entries(values))
		Object.defineProperty(element, name, { value, configurable: true });
};

const createFixture = (specs: RowSpec[]) => {
	document.body.innerHTML = "";
	const container = document.createElement("div");
	const content = document.createElement("div");
	container.append(content);
	document.body.append(container);

	let scrollTop = 0;
	Object.defineProperty(container, "scrollTop", {
		configurable: true,
		get: () => scrollTop,
		set: (value: number) => {
			scrollTop = value;
		},
	});

	const layout = (): void => {
		let top = 0;
		for (const node of Array.from(content.children)) {
			if (!(node instanceof HTMLElement)) continue;
			const height = Number(node.dataset.testHeight ?? 0);
			define(node, { offsetTop: top, offsetHeight: height });
			top += height;
		}
		define(container, { scrollHeight: top, clientHeight: CLIENT_HEIGHT });
	};

	const rowFor = (spec: RowSpec): HTMLElement => {
		const row = document.createElement("div");
		row.dataset.testHeight = String(spec.height);
		if (spec.uri === undefined) return row;

		const relative = document.createElement("div");
		const message = document.createElement("div");
		message.setAttribute("data-message-uri", spec.uri);
		define(message, { offsetTop: 0, offsetHeight: spec.height });
		relative.append(message);
		row.append(relative);
		return row;
	};

	for (const spec of specs) content.append(rowFor(spec));
	layout();

	return {
		surface: createDomScrollSurface(
			() => container,
			() => content,
		),
		scrollTo: (value: number): void => {
			container.scrollTop = value;
		},
		prepend: (incoming: RowSpec[]): void => {
			content.prepend(...incoming.map(rowFor));
			layout();
		},
	};
};

describe("createDomScrollSurface", () => {
	it("resolves the row key from the nested message element", () => {
		const { surface } = createFixture(makeSpecs("m", 3, 100));

		expect(surface.rowKey(0)).toBe("at://m-0");
		expect(surface.rowKey(2)).toBe("at://m-2");
	});

	it("leaves divider rows keyless", () => {
		const { surface } = createFixture([
			{ height: 24 },
			{ uri: "at://m-0", height: 100 },
		]);

		expect(surface.rowKey(0)).toBeUndefined();
		expect(surface.rowKey(1)).toBe("at://m-0");
	});

	it("measures the row rather than the nested message element", () => {
		const { surface, scrollTo } = createFixture(makeSpecs("m", 20, 100));
		scrollTo(250);

		expect(surface.rowOffsetOfKey("at://m-3")).toBe(50);
		expect(surface.rowOffsetOfKey("at://m-3")).toBe(surface.rowOffset(3));
	});

	it("reports no offset for a key that is not mounted", () => {
		const { surface } = createFixture(makeSpecs("m", 3, 100));

		expect(surface.rowOffsetOfKey("at://gone")).toBeUndefined();
	});

	it("anchors a real row so a prepend restores the exact position", () => {
		const { surface, scrollTo, prepend } = createFixture(
			makeSpecs("m", 20, 100),
		);
		scrollTo(0);

		const anchor = captureAnchor(surface);
		expect(anchor.mode).toBe("row");

		prepend(makeSpecs("older", 50, 100));

		expect(anchoredScrollTop(surface, anchor)).toBe(5000);
	});

	it("keeps anchoring across a prepend when the reader sits mid-list", () => {
		const { surface, scrollTo, prepend } = createFixture(
			makeSpecs("m", 20, 100),
		);
		scrollTo(640);

		const anchor = captureAnchor(surface);
		prepend(makeSpecs("older", 10, 100));

		expect(anchoredScrollTop(surface, anchor)).toBe(1640);
	});
});
