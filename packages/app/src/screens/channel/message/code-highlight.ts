import {
	detectLanguage,
	highlight,
	normalizeLanguage,
	setConfig,
} from "@arborium/arborium";
import { classifyThrown, createLogger } from "@colibri-social/lib";
import type { RichTextHighlighter } from "@colibri-social/ui";

const log = createLogger("code-highlight");

setConfig({
	logger: {
		debug: () => {},
		warn: (message: unknown) => log.warn(String(message)),
		error: (message: unknown) => log.error(String(message)),
	},
});

export const highlightCode: RichTextHighlighter = async (lang, code) => {
	const language = lang ? normalizeLanguage(lang) : detectLanguage(code);
	if (!language) return null;
	try {
		return await highlight(language, code);
	} catch (error) {
		log.warn("highlight failed", {
			code: classifyThrown(error, { method: "highlight" }).code,
		});
		return null;
	}
};
