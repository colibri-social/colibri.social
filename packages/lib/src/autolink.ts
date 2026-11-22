export interface Autolink {
	start: number;
	end: number;
	uri: string;
}

const URL_REGEX = /(^|\s|\()((?:https?|at):\/\/\S+)/gi;
const TRAILING_PUNCTUATION_REGEX = /[.,;:!?'"‘’“”\]}]$/;
const TRAILING_POSSESSIVE_REGEX = /['’]s$/i;
const AT_URI_REGEX =
	/^at:\/\/(did:[a-z]+:[a-zA-Z0-9._:%-]+|[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+)(\/[a-zA-Z0-9._~:%-]+)*$/;

export const AUTOLINK_SCHEME_REGEX = /^(?:https?|at):\/\//i;

export const isAtUri = (uri: string): boolean => {
	return AT_URI_REGEX.test(uri);
};

const trimTrailingPunctuation = (uri: string): string => {
	let trimmed = uri;

	for (;;) {
		if (TRAILING_POSSESSIVE_REGEX.test(trimmed)) {
			trimmed = trimmed.slice(0, -2);
			continue;
		}

		if (TRAILING_PUNCTUATION_REGEX.test(trimmed)) {
			trimmed = trimmed.slice(0, -1);
			continue;
		}

		if (trimmed.endsWith(")") && !trimmed.includes("(")) {
			trimmed = trimmed.slice(0, -1);
			continue;
		}

		return trimmed;
	}
};

export const findAutolinks = (source: string): Autolink[] => {
	const links: Autolink[] = [];
	const re = new RegExp(URL_REGEX.source, URL_REGEX.flags);

	let match: RegExpExecArray | null;
	while ((match = re.exec(source))) {
		const start = match.index + match[1].length;
		const uri = trimTrailingPunctuation(match[2]);

		if (/^at:/i.test(uri) && !isAtUri(uri)) continue;
		if (!/^[a-z]+:\/\/./i.test(uri)) continue;

		links.push({ start, end: start + uri.length, uri });
	}

	return links;
};
