import type { EditorJSON, RichEditorHandle } from "@colibri-social/ui";
import { createRoot, createSignal } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSource, setLatency } from "./mock/source";
import { readStored, writeStored } from "./persist";
import {
	createComposerDraft,
	readAttachmentDraft,
	readComposerDraft,
	readEditDraft,
	writeAttachmentDraft,
	writeComposerDraft,
	writeEditDraft,
} from "./persist-drafts";
import { createDataStore } from "./store";

const until = async (check: () => boolean, timeout = 8000) => {
	const started = performance.now();
	while (!check()) {
		if (performance.now() - started > timeout) throw new Error("Timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type DraftNode = { type: string; text?: string; content?: DraftNode[] };

const doc = (text: string): EditorJSON =>
	({
		type: "doc",
		content: text
			? [{ type: "paragraph", content: [{ type: "text", text }] }]
			: [{ type: "paragraph" }],
	}) as unknown as EditorJSON;

const textOf = (json: EditorJSON | undefined) =>
	(json as DraftNode | undefined)?.content?.[0]?.content?.[0]?.text ?? "";

const fakeEditor = (initial = "") => {
	let json = doc(initial);
	const handle = {
		getJSON: () => json,
		setJSON: (next: EditorJSON) => {
			json = next;
		},
		isEmpty: () => textOf(json) === "",
		type: (text: string) => {
			json = doc(text);
		},
	};
	return handle as unknown as RichEditorHandle & { type: (t: string) => void };
};

const touched = new Set<string>();
const remember = (key: string) => {
	touched.add(key);
	return key;
};

afterEach(() => {
	for (const key of touched) localStorage.removeItem(key);
	touched.clear();
	vi.unstubAllGlobals();
});

describe("storage helper", () => {
	it("reads and writes through localStorage", () => {
		const key = remember("colibri:test-persist");
		writeStored(key, "value");
		expect(readStored(key)).toBe("value");
		writeStored(key, undefined);
		expect(readStored(key)).toBeUndefined();
	});

	it("survives storage that throws on every access", () => {
		vi.stubGlobal("localStorage", {
			getItem: () => {
				throw new Error("denied");
			},
			setItem: () => {
				throw new Error("denied");
			},
			removeItem: () => {
				throw new Error("denied");
			},
		});
		expect(() => writeStored("colibri:test-persist", "x")).not.toThrow();
		expect(readStored("colibri:test-persist")).toBeUndefined();
		expect(() => writeComposerDraft("channel", doc("hi"))).not.toThrow();
		expect(readComposerDraft("channel")).toBeUndefined();
	});

	it("drops malformed drafts", () => {
		remember("colibri:draft:broken");
		remember("colibri:edit:broken");
		localStorage.setItem("colibri:draft:broken", "{");
		localStorage.setItem("colibri:edit:broken", JSON.stringify({ text: 1 }));
		expect(readComposerDraft("broken")).toBeUndefined();
		expect(readEditDraft("broken")).toBeUndefined();
	});
});

describe("composer drafts", () => {
	it("saves after typing, restores into an empty editor and clears on send", async () => {
		const key = "at://did:plc:test/space/draft-channel";
		remember(`colibri:draft:${key}`);
		const first = fakeEditor();
		const dispose = createRoot((dispose) => {
			const draft = createComposerDraft({ key: () => key });
			draft.bind(first);
			first.type("half a thought");
			draft.changed();
			return dispose;
		});
		await wait(400);
		expect(textOf(readComposerDraft(key))).toBe("half a thought");
		dispose();

		const second = fakeEditor();
		let clear: () => void = () => {};
		const disposeSecond = createRoot((dispose) => {
			const draft = createComposerDraft({ key: () => key });
			draft.bind(second);
			clear = draft.clear;
			return dispose;
		});
		await until(() => textOf(second.getJSON()) === "half a thought");
		clear();
		expect(readComposerDraft(key)).toBeUndefined();
		disposeSecond();
	});

	it("flushes a pending save on cleanup and removes empty drafts", async () => {
		const key = "at://did:plc:test/space/flush-channel";
		remember(`colibri:draft:${key}`);
		const editor = fakeEditor();
		const dispose = createRoot((dispose) => {
			const draft = createComposerDraft({ key: () => key });
			draft.bind(editor);
			editor.type("quick");
			draft.changed();
			return dispose;
		});
		dispose();
		expect(textOf(readComposerDraft(key))).toBe("quick");

		const blank = fakeEditor();
		let changed: () => void = () => {};
		const disposeEmpty = createRoot((dispose) => {
			const draft = createComposerDraft({ key: () => key });
			draft.bind(blank);
			changed = draft.changed;
			return dispose;
		});
		await until(() => textOf(blank.getJSON()) === "quick");
		blank.type("");
		changed();
		disposeEmpty();
		expect(readComposerDraft(key)).toBeUndefined();
	});

	it("does not save while paused for an edit", async () => {
		const key = "at://did:plc:test/space/paused-channel";
		remember(`colibri:draft:${key}`);
		writeComposerDraft(key, doc("kept"));
		const editor = fakeEditor("edited message");
		const dispose = createRoot((dispose) => {
			const draft = createComposerDraft({ key: () => key, paused: () => true });
			draft.bind(editor);
			draft.changed();
			return dispose;
		});
		await wait(400);
		dispose();
		expect(textOf(readComposerDraft(key))).toBe("kept");
	});

	it("keeps attachments for a channel across composer remounts", async () => {
		const key = "at://did:plc:test/space/attachments";
		const file = new File(["x"], "notes.txt", { type: "text/plain" });
		const [files, setFiles] = createSignal<readonly File[]>([]);
		const dispose = createRoot((dispose) => {
			createComposerDraft({
				key: () => key,
				attachments: { files, add: (next) => setFiles(next) },
			});
			return dispose;
		});
		setFiles([file]);
		await wait(0);
		dispose();
		setFiles([]);
		await wait(0);
		expect(readAttachmentDraft(key)).toEqual([file]);

		const [restored, setRestored] = createSignal<readonly File[]>([]);
		const disposeAgain = createRoot((dispose) => {
			createComposerDraft({
				key: () => key,
				attachments: { files: restored, add: (next) => setRestored(next) },
			});
			return dispose;
		});
		expect(restored()).toEqual([file]);
		setRestored([]);
		await wait(0);
		expect(readAttachmentDraft(key)).toEqual([]);
		disposeAgain();
		writeAttachmentDraft(key, []);
	});

	it("round-trips edit drafts", () => {
		const key = "at://did:plc:test/space/edit/3l2abc";
		remember(`colibri:edit:${key}`);
		writeEditDraft(key, { text: "fixed typo", facets: [] });
		expect(readEditDraft(key)).toEqual({ text: "fixed typo", facets: [] });
		writeEditDraft(key, undefined);
		expect(readEditDraft(key)).toBeUndefined();
	});
});

describe("last viewed channel", () => {
	it("persists the last channel per Space and the last Space", async () => {
		setLatency(0);
		remember("colibri:last-space");
		remember("colibri:last-channel:did:plc:persisted");
		const store = createDataStore(createMockSource({ live: false }));
		store.setLastChannel("did:plc:persisted", "general");
		expect(store.lastSpace()).toBe("did:plc:persisted");
		expect(localStorage.getItem("colibri:last-space")).toBe(
			"did:plc:persisted",
		);
		const fresh = createDataStore(createMockSource({ live: false }));
		expect(fresh.lastSpace()).toBe("did:plc:persisted");
		expect(fresh.lastChannel("did:plc:persisted")).toBe("general");
		expect(fresh.lastChannel("did:plc:elsewhere")).toBeUndefined();
	});
});
