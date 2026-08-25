import type { Node as ProseMirrorNode } from "prosemirror-model";
import {
	type CodeContext,
	codeContextAt,
} from "../../../../utils/code-context";

export interface BlockProjection {
	text: string;
	positions: number[];
}

export const projectBlock = (
	node: ProseMirrorNode,
	pos: number,
): BlockProjection => {
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

export const cursorLine = (
	text: string,
	positions: number[],
	cursorPos: number,
): { lineStart: number; lineEnd: number; line: string } | null => {
	const cursorIndex = positions.indexOf(cursorPos);
	if (cursorIndex === -1) return null;
	const lineStart = text.lastIndexOf("\n", cursorIndex - 1) + 1;
	const nl = text.indexOf("\n", cursorIndex);
	const lineEnd = nl === -1 ? text.length : nl;
	return { lineStart, lineEnd, line: text.slice(lineStart, lineEnd) };
};

export const codeContextAtPos = (
	doc: ProseMirrorNode,
	pos: number,
): CodeContext | null => {
	const $pos = doc.resolve(pos);
	if (!$pos.parent.isTextblock) return null;

	const { text, positions } = projectBlock($pos.parent, $pos.before());
	const index = positions.indexOf(pos);
	if (index === -1) return null;

	return codeContextAt(text, index);
};
