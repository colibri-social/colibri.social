import { type MarkdownToken, tokenizeMarkdown } from "@colibri-social/lib";
import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "prosemirror-model";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet, type EditorView } from "prosemirror-view";
import { MARKDOWN_LINK_POLICY } from "../../utils/rich-text/link-safety";
import { projectBlock } from "./block-projection";
import type { CodeHighlighter, HighlightSpan } from "./types";

type SpanCacheEntry = HighlightSpan[] | null | "loading";

const SPAN_CACHE_LIMIT = 50;

const pluginKey = new PluginKey<DecorationSet>("markdownDecorations");

const CONTENT_CLASS: Partial<Record<MarkdownToken["kind"], string>> = {
	bold: "font-bold",
	italic: "italic",
	underline: "underline",
	strikethrough: "line-through",
	code: "font-mono text-[0.9em] bg-muted rounded-[2px] px-0.5",
	quote: "text-muted-foreground",
	link: "text-[color-mix(in_srgb,var(--primary)_35%,var(--foreground))]",
	subtext: "text-xs text-muted-foreground",
	spoiler: "bg-muted rounded-[2px]",
};

const MARKER_CLASS = "text-muted-foreground";

export type MarkdownDecorationsOptions = {
	highlightCode?: () => CodeHighlighter | undefined;
};

export const MarkdownDecorations = Extension.create<MarkdownDecorationsOptions>(
	{
		name: "markdownDecorations",

		addOptions() {
			return { highlightCode: undefined };
		},

		addProseMirrorPlugins() {
			let view: EditorView | null = null;
			const spanCache = new Map<string, SpanCacheEntry>();
			const options = this.options;

			const remember = (key: string, entry: SpanCacheEntry) => {
				if (spanCache.size >= SPAN_CACHE_LIMIT && !spanCache.has(key)) {
					const oldest = spanCache.keys().next().value;
					if (oldest !== undefined) spanCache.delete(oldest);
				}
				spanCache.set(key, entry);
			};

			const requestSpans = (
				lang: string | undefined,
				code: string,
			): SpanCacheEntry => {
				const highlight = options.highlightCode?.();
				if (!highlight) return null;
				const key = `${lang ?? ""}\u0000${code}`;
				const cached = spanCache.get(key);
				if (cached !== undefined) return cached;

				let result: ReturnType<CodeHighlighter>;
				try {
					result = highlight(lang, code);
				} catch {
					remember(key, null);
					return null;
				}
				if (!(result instanceof Promise)) {
					remember(key, result);
					return result;
				}

				remember(key, "loading");
				result
					.catch(() => null)
					.then((spans) => {
						remember(key, spans);
						if (spans && view && !view.isDestroyed) {
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
			) => {
				const [openStart, openEnd] = token.markers[0];
				const [closeStart, closeEnd] = token.markers[1] ?? token.markers[0];
				const [codeStart, codeEnd] = token.content;

				const dim = {
					class: `${MARKER_CLASS} font-mono`,
					spellcheck: "false",
					autocorrect: "off",
				};
				decorations.push(
					Decoration.inline(positions[openStart], positions[openEnd], dim),
				);
				if (token.markers[1]) {
					decorations.push(
						Decoration.inline(positions[closeStart], positions[closeEnd], dim),
					);
				}
				if (codeEnd > codeStart) {
					decorations.push(
						Decoration.inline(positions[codeStart], positions[codeEnd], {
							class: "font-mono",
							spellcheck: "false",
							autocorrect: "off",
						}),
					);
				}

				const spans = requestSpans(token.lang, text.slice(codeStart, codeEnd));
				if (!spans || spans === "loading") return;

				for (const span of spans) {
					const from = positions[codeStart + span.start];
					const to = positions[codeStart + span.end];
					if (from === undefined || to === undefined || from >= to) continue;
					decorations.push(
						Decoration.inline(from, to, { nodeName: `a-${span.tag}` }),
					);
				}
			};

			const computeDecorations = (doc: ProseMirrorNode): DecorationSet => {
				const decorations: Decoration[] = [];

				doc.descendants((node, pos) => {
					if (!node.isTextblock) return;

					const { text, positions } = projectBlock(node, pos);
					const tokens = tokenizeMarkdown(text).filter(
						(token) =>
							token.kind !== "link" ||
							MARKDOWN_LINK_POLICY.allowLink(
								text.slice(token.content[0], token.content[1]),
								token.uri ?? "",
							),
					);

					const subtextLineStarts = new Set(
						tokens
							.filter((token) => token.kind === "subtext")
							.map((token) => token.markers[0][0]),
					);
					if (subtextLineStarts.size > 0) {
						let lineStart = 0;
						const allSubtext = text.split("\n").every((line) => {
							const isSubtext = subtextLineStarts.has(lineStart);
							lineStart += line.length + 1;
							return isSubtext;
						});
						if (allSubtext) {
							decorations.push(
								Decoration.node(pos, pos + node.nodeSize, {
									class: "subtext-block",
								}),
							);
						}
					}

					for (const token of tokens) {
						if (token.kind === "codeblock") {
							highlightCodeblock(decorations, token, text, positions);
							continue;
						}

						const markerClass =
							token.kind === "subtext"
								? `${MARKER_CLASS} text-xs`
								: MARKER_CLASS;
						for (const [markerStart, markerEnd] of token.markers) {
							if (markerStart === markerEnd) continue;
							decorations.push(
								Decoration.inline(
									positions[markerStart],
									positions[markerEnd],
									{ class: markerClass },
								),
							);
						}

						const contentClass = CONTENT_CLASS[token.kind];
						const [contentStart, contentEnd] = token.content;
						if (contentClass && contentEnd > contentStart) {
							decorations.push(
								Decoration.inline(
									positions[contentStart],
									positions[contentEnd],
									{ class: contentClass },
								),
							);
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
							if (tr.getMeta(pluginKey) === "full" || tr.docChanged) {
								return computeDecorations(newState.doc);
							}
							return old;
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
	},
);
