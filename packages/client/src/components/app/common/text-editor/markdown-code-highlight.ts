import {
	detectLanguage,
	type Grammar,
	highlights,
	loadGrammar,
	normalizeLanguage,
} from "@arborium/arborium";
import { type MarkdownToken, tokenizeMarkdown } from "@colibri-social/lib";
import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "prosemirror-model";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet, type EditorView } from "prosemirror-view";

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

const SPAN_CACHE_LIMIT = 50;
const spanCache = new Map<string, ReturnType<Grammar["parse"]>["spans"]>();

const pluginKey = new PluginKey<DecorationSet>("markdownDecorations");


const CONTENT_CLASS: Partial<Record<MarkdownToken["kind"], string>> = {
	bold: "font-bold",
	italic: "italic",
	underline: "underline",
	strikethrough: "line-through",
	code: "font-mono bg-muted/40 rounded-xs px-0.5",
	quote: "text-muted-foreground",
	link: "text-(--primary-hover)",
};

const MARKER_CLASS = "text-muted-foreground/60";

interface BlockProjection {
	text: string;
	positions: number[];
}

/**
 * Builds the raw-text projection of a single textblock and a string-index →
 * doc-position map
 */
const projectBlock = (node: ProseMirrorNode, pos: number): BlockProjection => {
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
		} else {
			positions.push(pos + 1 + offset);
			text += "￼";
		}
	});
	positions.push(pos + 1 + node.content.size);
	return { text, positions };
};

/**
 * Live markdown decorations: keeps the literal syntax visible but 
 * dims the markers and styles the content between them
 */
export const MarkdownDecorations = Extension.create({
	name: "markdownDecorations",

	addProseMirrorPlugins() {
		let view: EditorView | null = null;

		const requestGrammar = (lang: string): GrammarCacheEntry => {
			if (grammarCache.has(lang)) return grammarCache.get(lang)!;

			grammarCache.set(lang, "loading");
			loadGrammar(lang)
				.catch(() => null)
				.then((grammar) => {
					grammarCache.set(lang, grammar);
					if (grammar && view && !view.isDestroyed) {
						view.dispatch(view.state.tr.setMeta(pluginKey, "full"));
					}
				});
			return "loading";
		};

		const highlightCodeblock = (
			decorations: Decoration[],
			token: MarkdownToken,
			text: string,
			positions: number[],
		): void => {
			const [openStart, openEnd] = token.markers[0];
			const [closeStart, closeEnd] = token.markers[1];
			const [codeStart, codeEnd] = token.content;

			const dim = {
				class: `${MARKER_CLASS} font-mono`,
				spellcheck: "false",
				autocorrect: "off",
			};
			decorations.push(
				Decoration.inline(positions[openStart], positions[openEnd], dim),
				Decoration.inline(positions[closeStart], positions[closeEnd], dim),
				Decoration.inline(positions[codeStart], positions[codeEnd], {
					class: "font-mono",
					spellcheck: "false",
					autocorrect: "off",
				}),
			);

			const code = text.slice(codeStart, codeEnd);
			const lang = token.lang
				? normalizeLanguage(token.lang)
				: detectLanguage(code);
			if (!lang) return;

			const grammar = requestGrammar(lang);
			if (!grammar || grammar === "loading") return;

			const cacheKey = `${lang} ${code}`;
			let spans = spanCache.get(cacheKey);
			if (!spans) {
				try {
					spans = grammar.parse(code).spans;
				} catch {
					return;
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
				decorations.push(Decoration.inline(from, to, { nodeName: `a-${tag}` }));
			}
		};

		const computeDecorations = (doc: ProseMirrorNode): DecorationSet => {
			const decorations: Decoration[] = [];

			doc.descendants((node, pos) => {
				if (!node.isTextblock) return;

				const { text, positions } = projectBlock(node, pos);
				const tokens = tokenizeMarkdown(text);

				for (const token of tokens) {
					if (token.kind === "codeblock") {
						highlightCodeblock(decorations, token, text, positions);
						continue;
					}

					for (const [markerStart, markerEnd] of token.markers) {
						if (markerStart === markerEnd) continue;
						decorations.push(
							Decoration.inline(positions[markerStart], positions[markerEnd], {
								class: MARKER_CLASS,
							}),
						);
					}

					const contentClass = CONTENT_CLASS[token.kind];
					if (contentClass) {
						const [contentStart, contentEnd] = token.content;
						if (contentEnd > contentStart) {
							decorations.push(
								Decoration.inline(
									positions[contentStart],
									positions[contentEnd],
									{ class: contentClass },
								),
							);
						}
					}
				}
			});

			return DecorationSet.create(doc, decorations);
		};

		return [
			new Plugin({
				key: pluginKey,
				state: {
					init: (_, state) => computeDecorations(state.doc),
					apply: (tr, old, _oldState, newState) => {
						if (tr.getMeta(pluginKey) === "full") {
							return computeDecorations(newState.doc);
						}
						if (!tr.docChanged) return old;
						return computeDecorations(newState.doc);
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
