import type { UnreadHint } from "./Notifications";

export type CursorSource =
	| "local"
	| "snapshot"
	| "hint"
	| "network"
	| "timeout";

export type CursorResolution = {
	cursor: string | undefined;
	source: CursorSource;
	resolved: boolean;
};

export const isTrustedCursorSource = (source: CursorSource): boolean =>
	source !== "timeout";

export const resolveCursorFast = (input: {
	local: string | undefined;
	snapshot: string | undefined;
	hint: UnreadHint;
}): CursorResolution => {
	if (input.local !== undefined) {
		return { cursor: input.local, source: "local", resolved: true };
	}
	if (input.snapshot !== undefined) {
		return { cursor: input.snapshot, source: "snapshot", resolved: true };
	}
	if (input.hint === "read") {
		return { cursor: undefined, source: "hint", resolved: true };
	}
	return { cursor: undefined, source: "network", resolved: false };
};
