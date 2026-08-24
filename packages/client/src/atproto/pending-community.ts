import { createSignal } from "solid-js";

const KEY_PREFIX = "colibri:pendingCommunity:";

export const RESUME_WINDOW_MS = 30 * 60 * 1000;

export type PendingCreation = {
	name: string;
	requiresApprovalToJoin: boolean;
	startedAt: number;
	imagesDropped: boolean;
	did?: string;
};

const keyFor = (ns: string): string => KEY_PREFIX + ns;

export const readPending = (ns: string): PendingCreation | undefined => {
	try {
		const raw = localStorage.getItem(keyFor(ns));
		if (!raw) return undefined;
		const parsed = JSON.parse(raw) as Partial<PendingCreation>;
		if (typeof parsed.name !== "string") return undefined;
		if (typeof parsed.startedAt !== "number") return undefined;
		return {
			name: parsed.name,
			requiresApprovalToJoin: parsed.requiresApprovalToJoin === true,
			startedAt: parsed.startedAt,
			imagesDropped: parsed.imagesDropped === true,
			...(typeof parsed.did === "string" ? { did: parsed.did } : {}),
		};
	} catch {
		return undefined;
	}
};

export const writePending = (ns: string, pending: PendingCreation): void => {
	try {
		localStorage.setItem(keyFor(ns), JSON.stringify(pending));
	} catch {}
};

export const advancePending = (ns: string, did: string): void => {
	const pending = readPending(ns);
	if (!pending || pending.did === did) return;
	writePending(ns, { ...pending, did });
};

export const clearPending = (ns: string): void => {
	try {
		localStorage.removeItem(keyFor(ns));
	} catch {}
};

const [creationInFlight, setCreationInFlight] = createSignal(false);

export { creationInFlight, setCreationInFlight };

export type ResumeProbe =
	| { found: true; isMember: boolean }
	| { found: false }
	| { unknown: true };

export type ResumeDecision = "done" | "wait" | "abandon";

export const decideResume = (
	probe: ResumeProbe,
	ageMs: number,
): ResumeDecision => {
	if ("found" in probe && probe.found) {
		return probe.isMember
			? "done"
			: ageMs < RESUME_WINDOW_MS
				? "wait"
				: "abandon";
	}
	return ageMs < RESUME_WINDOW_MS ? "wait" : "abandon";
};
