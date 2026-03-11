import DOMPurify from "dompurify";

const purifier = DOMPurify();

/**
 * Purifies given text to sanitize out malicious HTML.
 * @param text The text to sanitize
 */
export const purify = (text: string) => {
	return purifier.sanitize(text);
};
