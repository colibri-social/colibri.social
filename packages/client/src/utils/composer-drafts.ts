import type { ColibriRichTextFacet } from "@colibri-social/lib";
import type { Editor } from "@tiptap/core";

type EditorJSON = ReturnType<Editor["getJSON"]>;

export type EditDraft = {
	text: string;
	facets: Array<ColibriRichTextFacet>;
};

const DRAFT_PREFIX = "colibri:draft:";
const EDIT_PREFIX = "colibri:edit:";

type DraftNode = {
	type?: string;
	text?: string;
	content?: Array<DraftNode>;
};

/**
 * Rewrites blockquote nodes left in older drafts into the literal `> ` markers
 * the editor uses now, so they still load against the current schema
 */
const QUOTE_MARKER: DraftNode = { type: "text", text: "> " };

const prefixQuoteLines = (content: Array<DraftNode>): Array<DraftNode> => {
	const out: Array<DraftNode> = [QUOTE_MARKER];
	for (const child of content) {
		out.push(child);
		if (child.type === "hardBreak") out.push(QUOTE_MARKER);
	}
	return out;
};

const flattenDraftQuotes = (nodes: Array<DraftNode>): Array<DraftNode> =>
	nodes.flatMap((node) => {
		if (node.type === "blockquote") {
			return flattenDraftQuotes(node.content ?? []).map((child) => ({
				type: "paragraph",
				content: prefixQuoteLines(child.content ?? []),
			}));
		}
		if (node.content) {
			return [{ ...node, content: flattenDraftQuotes(node.content) }];
		}
		return [node];
	});

export const readComposerDraft = (
	channelUri: string,
): EditorJSON | undefined => {
	try {
		const raw = localStorage.getItem(DRAFT_PREFIX + channelUri);
		if (!raw) return undefined;
		const parsed = JSON.parse(raw) as EditorJSON;
		return {
			...parsed,
			content: flattenDraftQuotes(
				(parsed.content ?? []) as Array<DraftNode>,
			) as EditorJSON["content"],
		};
	} catch {
		return undefined;
	}
};

export const writeComposerDraft = (
	channelUri: string,
	json: EditorJSON | undefined,
): void => {
	try {
		if (!json) {
			localStorage.removeItem(DRAFT_PREFIX + channelUri);
		} else {
			localStorage.setItem(DRAFT_PREFIX + channelUri, JSON.stringify(json));
		}
	} catch {}
};

export const readEditDraft = (uri: string): EditDraft | undefined => {
	try {
		const raw = localStorage.getItem(EDIT_PREFIX + uri);
		return raw ? (JSON.parse(raw) as EditDraft) : undefined;
	} catch {
		return undefined;
	}
};

export const writeEditDraft = (uri: string, draft: EditDraft): void => {
	try {
		localStorage.setItem(EDIT_PREFIX + uri, JSON.stringify(draft));
	} catch {}
};

export const clearEditDraft = (uri: string): void => {
	try {
		localStorage.removeItem(EDIT_PREFIX + uri);
	} catch {}
};
