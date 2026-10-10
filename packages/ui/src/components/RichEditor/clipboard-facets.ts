import { type ColibriRichTextFacet, facetsToSource } from "@colibri-social/lib";
import { copyText } from "../../utils/clipboard";
import { escapeHtml } from "../../utils/rich-text/html-escape";

const CLIPBOARD_HTML_ATTR = "data-colibri-message";

type ClipboardPayload = {
	text: string;
	facets: Array<ColibriRichTextFacet>;
};

const isWellFormed = (facet: unknown): facet is ColibriRichTextFacet => {
	if (typeof facet !== "object" || facet === null) return false;
	const { index, features } = facet as Partial<ColibriRichTextFacet>;
	return (
		typeof index?.byteStart === "number" &&
		typeof index.byteEnd === "number" &&
		index.byteEnd > index.byteStart &&
		Array.isArray(features) &&
		features.every(
			(feature) =>
				typeof feature === "object" &&
				feature !== null &&
				typeof feature.$type === "string",
		)
	);
};

const utf8ToBase64 = (str: string): string => {
	const bytes = new TextEncoder().encode(str);
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
};

const base64ToUtf8 = (base64: string): string => {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return new TextDecoder().decode(bytes);
};

export const buildClipboardHtml = (
	text: string,
	facets: Array<ColibriRichTextFacet>,
): string => {
	const payload = utf8ToBase64(JSON.stringify({ text, facets }));
	const { source } = facetsToSource(text, facets);
	const visible = escapeHtml(source).replace(/\n/g, "<br>");
	return `<div ${CLIPBOARD_HTML_ATTR}="${payload}">${visible}</div>`;
};

export const readClipboardFacets = (
	html: string | undefined | null,
): ClipboardPayload | null => {
	if (!html) return null;
	const match = html.match(new RegExp(`${CLIPBOARD_HTML_ATTR}="([^"]*)"`));
	if (!match) return null;
	try {
		const parsed = JSON.parse(base64ToUtf8(match[1])) as ClipboardPayload;
		if (typeof parsed.text !== "string" || !Array.isArray(parsed.facets)) {
			return null;
		}
		return { text: parsed.text, facets: parsed.facets.filter(isWellFormed) };
	} catch {
		return null;
	}
};

export const copyMessageToClipboard = async (
	text: string,
	facets: Array<ColibriRichTextFacet>,
	anchor?: HTMLElement | null,
): Promise<boolean> => {
	const { source } = facetsToSource(text, facets);
	const html = buildClipboardHtml(text, facets);

	if (
		window.isSecureContext &&
		typeof ClipboardItem !== "undefined" &&
		navigator.clipboard?.write
	) {
		try {
			await navigator.clipboard.write([
				new ClipboardItem({
					"text/plain": new Blob([source], { type: "text/plain" }),
					"text/html": new Blob([html], { type: "text/html" }),
				}),
			]);
			return true;
		} catch {
			return copyText(source, anchor);
		}
	}

	return copyText(source, anchor);
};
