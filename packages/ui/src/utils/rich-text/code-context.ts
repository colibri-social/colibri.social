import { tokenizeMarkdown } from "@colibri-social/lib";

export type CodeContext = "codeblock" | "code";

const MAX_FENCE_INDENT = 3;
const MIN_FENCE_LENGTH = 3;

interface FenceRun {
	char: string;
	length: number;
	info: string;
}

interface FenceRegion {
	start: number;
	end: number;
	unclosed: boolean;
}

const fenceRun = (line: string): FenceRun | null => {
	const indent = line.length - line.trimStart().length;
	if (indent > MAX_FENCE_INDENT) return null;

	const rest = line.slice(indent);
	const char = rest[0];
	if (char !== "`" && char !== "~") return null;

	let length = 0;
	while (rest[length] === char) length++;
	if (length < MIN_FENCE_LENGTH) return null;

	return { char, length, info: rest.slice(length) };
};

const opensFence = (run: FenceRun): boolean =>
	run.char === "~" || !run.info.includes("`");

const closesFence = (run: FenceRun, opening: FenceRun): boolean =>
	run.char === opening.char &&
	run.length >= opening.length &&
	run.info.trim() === "";

const fenceRegions = (text: string): FenceRegion[] => {
	const regions: FenceRegion[] = [];
	let opening: { run: FenceRun; start: number } | null = null;
	let lineStart = 0;

	for (;;) {
		const nextBreak = text.indexOf("\n", lineStart);
		const lineEnd = nextBreak === -1 ? text.length : nextBreak;
		const run = fenceRun(text.slice(lineStart, lineEnd));

		if (opening) {
			if (run && closesFence(run, opening.run)) {
				regions.push({ start: opening.start, end: lineEnd, unclosed: false });
				opening = null;
			}
		} else if (run && opensFence(run)) {
			opening = { run, start: lineStart };
		}

		if (nextBreak === -1) break;
		lineStart = nextBreak + 1;
	}

	if (opening) {
		regions.push({ start: opening.start, end: text.length, unclosed: true });
	}

	return regions;
};

const inFenceRegion = (region: FenceRegion, index: number): boolean =>
	index >= region.start &&
	(region.unclosed ? index <= region.end : index < region.end);

export const codeContextAt = (
	text: string,
	index: number,
): CodeContext | null => {
	for (const region of fenceRegions(text)) {
		if (inFenceRegion(region, index)) return "codeblock";
	}

	for (const token of tokenizeMarkdown(text)) {
		if (token.kind !== "code") continue;
		const start = token.markers[0][0];
		const end = (token.markers[1] ?? token.markers[0])[1];
		if (index > start && index < end) return "code";
	}

	return null;
};
