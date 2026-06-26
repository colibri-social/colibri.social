import {
	detectLanguage,
	highlights,
	loadGrammar,
	normalizeLanguage,
	type Grammar,
} from "@arborium/arborium";
import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "prosemirror-model";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet, type EditorView } from "prosemirror-view";
import { createFenceRegex } from "../../../../utils/fenced-code-regex";

type FenceMatchIndices = RegExpMatchArray & {
	indices: Array<[number, number]>;
};

const captureToTag = new Map<string, string>(
	highlights.map((h) => [h.name, h.tag]),
);

const resolveTag = (capture: string): string | undefined => {
	let name = capture;
	while (name) {
		const tag = captureToTag.get(name);
		if (tag) return tag;
		const lastDot = name.lastIndexOf(".");
		if (lastDot === -1) break;
		name = name.slice(0, lastDot);
	}
	return undefined;
};

type GrammarCacheEntry = Grammar | null | "loading";
const grammarCache = new Map<string, GrammarCacheEntry>();

// Tree-sitter style parsing is the expensive part of highlighting, so cache
// spans per (lang, code) pair — typing inside one fence shouldn't force a
// reparse of every other unchanged fence in the document.
const SPAN_CACHE_LIMIT = 50;
const spanCache = new Map<string, ReturnType<Grammar["parse"]>["spans"]>();

const pluginKey = new PluginKey<DecorationSet>("markdownCodeHighlight");

interface FenceRange {
	docFrom: number;
	docCodeFrom: number;
	docCodeTo: number;
	docTo: number;
	codeStart: number;
	positions: number[];
	lang: string | null;
	code: string;
}

/**
 * Live-highlights ```lang fenced code blocks while typing, keeping the raw
 * markdown fence markers visible and editable in the document (no separate
 * codeBlock node/conversion) — mirrors the fence detection in
 * prosemirror-to-facets.ts so what's highlighted here matches what becomes
 * a `codeblock` facet on send.
 */
export const MarkdownCodeHighlight = Extension.create({
	name: "markdownCodeHighlight",

	addProseMirrorPlugins() {
		let view: EditorView | null = null;

		const requestGrammar = (lang: string): GrammarCacheEntry => {
			// Use `.has()`, not a truthiness check on the value — a failed load
			// is cached as `null`, which is falsy, so a truthiness check can't
			// tell "never attempted" apart from "tried and failed" and ends up
			// retrying (and re-dispatching) forever for any unsupported language.
			if (grammarCache.has(lang)) return grammarCache.get(lang)!;

			grammarCache.set(lang, "loading");
			loadGrammar(lang)
				.catch(() => null)
				.then((grammar) => {
					grammarCache.set(lang, grammar);
					// Grammars load asynchronously, so the fence that requested this
					// one was rendered without syntax spans — recompute now that the
					// grammar is available.
					if (grammar && view && !view.isDestroyed) {
						view.dispatch(view.state.tr.setMeta(pluginKey, "full"));
					}
				});
			return "loading";
		};

		const findFenceRanges = (doc: ProseMirrorNode): FenceRange[] => {
			const ranges: FenceRange[] = [];

			doc.descendants((node, pos) => {
				if (!node.isTextblock) return;

				let text = "";
				const positions: number[] = [];
				node.forEach((child, offset) => {
					if (child.isText && child.text) {
						for (let i = 0; i < child.text.length; i++) {
							positions.push(pos + 1 + offset + i);
						}
						text += child.text;
					} else if (child.type.name === "hardBreak") {
						positions.push(pos + 1 + offset);
						text += "\n";
					}
				});
				positions.push(pos + 1 + node.content.size);

				const matches = [
					...text.matchAll(createFenceRegex()),
				] as FenceMatchIndices[];
				for (const match of matches) {
					const [matchStart, matchEnd] = match.indices[0];
					const [codeStart, codeEnd] = match.indices[2];
					const rawLang = match[1];
					const code = match[2];

					ranges.push({
						docFrom: positions[matchStart],
						docCodeFrom: positions[codeStart],
						docCodeTo: positions[codeEnd],
						docTo: positions[matchEnd],
						codeStart,
						positions,
						lang: rawLang ? normalizeLanguage(rawLang) : detectLanguage(code),
						code,
					});
				}
			});

			return ranges;
		};

		// Adds fence dimming + syntax-highlighted spans via grammar parsing. The
		// per-(lang, code) spanCache means a recompute only reparses the fence
		// that actually changed, so this is cheap enough to run synchronously on
		// every keystroke (messages are capped at 2048 chars).
		const computeFullDecorations = (doc: ProseMirrorNode): DecorationSet => {
			const decorations: Decoration[] = [];

			for (const range of findFenceRanges(doc)) {
				const {
					docFrom,
					docCodeFrom,
					docCodeTo,
					docTo,
					codeStart,
					positions,
					lang,
					code,
				} = range;

				decorations.push(
					Decoration.inline(docFrom, docCodeFrom, {
						class: "text-muted-foreground/60 font-mono",
					}),
					Decoration.inline(docCodeTo, docTo, {
						class: "text-muted-foreground/60 font-mono",
					}),
					Decoration.inline(docCodeFrom, docCodeTo, { class: "font-mono" }),
				);

				if (!lang) continue;

				const grammar = requestGrammar(lang);
				if (!grammar || grammar === "loading") continue;

				const cacheKey = `${lang} ${code}`;
				let spans = spanCache.get(cacheKey);
				if (!spans) {
					try {
						spans = grammar.parse(code).spans;
					} catch {
						// Parse failed — leave as plain monospace text.
						continue;
					}
					if (spanCache.size >= SPAN_CACHE_LIMIT) spanCache.clear();
					spanCache.set(cacheKey, spans);
				}

				for (const span of spans) {
					const tag = resolveTag(span.capture);
					if (!tag) continue;
					const from = positions[codeStart + span.start];
					const to = positions[codeStart + span.end];
					if (from === undefined || to === undefined || from >= to) continue;
					decorations.push(
						Decoration.inline(from, to, { nodeName: `a-${tag}` }),
					);
				}
			}

			return DecorationSet.create(doc, decorations);
		};

		return [
			new Plugin({
				key: pluginKey,
				state: {
					init: (_, state) => computeFullDecorations(state.doc),
					apply: (tr, old, _oldState, newState) => {
						if (tr.getMeta(pluginKey) === "full") {
							return computeFullDecorations(newState.doc);
						}
						if (!tr.docChanged) return old;

						// Recompute synchronously on every edit so highlights track
						// typing in real time. Unchanged fences hit the spanCache, so
						// only the actively-edited fence is reparsed.
						return computeFullDecorations(newState.doc);
					},
				},
				props: {
					decorations: (state) => pluginKey.getState(state),
				},
				view: (editorView) => {
					view = editorView;
					return {
						destroy() {
							view = null;
						},
					};
				},
			}),
		];
	},
});
