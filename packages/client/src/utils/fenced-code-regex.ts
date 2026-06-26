/**
 * Matches a ```lang fenced code block: an opening fence at the start of a
 * line (optionally followed by a language), the code body, then a closing
 * fence at the start of a line. Shared between the live-editor highlighter
 * and facet detection so both treat the same raw-markdown syntax identically.
 *
 * Requires the `d` (hasIndices) flag at use sites that need `match.indices`.
 */
export const FENCE_REGEX_SOURCE =
	"(?<=^|\\n)```([a-zA-Z0-9_+-]*)\\n([\\s\\S]*?)\\n```(?=\\n|$)";

export const createFenceRegex = (flags = "gd"): RegExp =>
	new RegExp(FENCE_REGEX_SOURCE, flags);
