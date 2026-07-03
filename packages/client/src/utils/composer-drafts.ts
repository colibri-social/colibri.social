import type { ColibriRichTextFacet } from "@colibri-social/lib";
import type { Editor } from "@tiptap/core";

type EditorJSON = ReturnType<Editor["getJSON"]>;

export type EditDraft = {
	text: string;
	facets: Array<ColibriRichTextFacet>;
};

const DRAFT_PREFIX = "colibri:draft:";
const EDIT_PREFIX = "colibri:edit:";

export const readComposerDraft = (
	channelUri: string,
): EditorJSON | undefined => {
	try {
		const raw = localStorage.getItem(DRAFT_PREFIX + channelUri);
		return raw ? (JSON.parse(raw) as EditorJSON) : undefined;
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
