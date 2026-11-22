import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "prosemirror-model";
import { Plugin, PluginKey, type Transaction } from "prosemirror-state";

const HARD_BREAK = "hardBreak";

const hardBreakPositions = (doc: ProseMirrorNode) => {
	const found: number[] = [];
	doc.descendants((node, pos) => {
		if (node.type.name === HARD_BREAK) found.push(pos);
	});
	return found;
};

export const splitHardBreaks = (tr: Transaction) => {
	const breaks = hardBreakPositions(tr.doc);
	for (const pos of breaks.reverse()) {
		tr.delete(pos, pos + 1);
		tr.split(pos);
	}
	return breaks.length > 0;
};

const pluginKey = new PluginKey("lineBlocks");

export const LineBlocks = Extension.create({
	name: "lineBlocks",

	onCreate() {
		const { state } = this.editor;
		const tr = state.tr;
		if (!splitHardBreaks(tr)) return;
		this.editor.view.dispatch(tr.setMeta("addToHistory", false));
	},

	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: pluginKey,
				appendTransaction: (transactions, _oldState, newState) => {
					if (!transactions.some((transaction) => transaction.docChanged)) {
						return null;
					}
					const tr = newState.tr;
					return splitHardBreaks(tr) ? tr : null;
				},
			}),
		];
	},
});
