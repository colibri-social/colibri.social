interface RequestEntry {
	kind: "request";
	method: string;
	startMs: number;
	durationMs: number;
	ok: boolean;
}

interface BootEntry {
	kind: "boot";
	stage: string;
	atMs: number;
}

type PerfEntry = RequestEntry | BootEntry;

interface MethodStats {
	method: string;
	count: number;
	p50: number;
	p95: number;
	max: number;
	avg: number;
}

interface ColibriPerf {
	report: () => MethodStats[];
	timeline: () => Array<Record<string, unknown>>;
	reset: () => void;
	entries: () => PerfEntry[];
}

declare global {
	interface Window {
		__colibriPerf?: ColibriPerf;
	}
}

const MAX_ENTRIES = 2000;

const entries: PerfEntry[] = [];
const seenStages = new Set<string>();

const push = (entry: PerfEntry): void => {
	entries.push(entry);
	if (entries.length > MAX_ENTRIES) entries.shift();
};

export const recordRequest = (
	method: string,
	startMs: number,
	durationMs: number,
	ok: boolean,
): void => {
	push({ kind: "request", method, startMs, durationMs, ok });
};

export const markBoot = (stage: string): void => {
	if (seenStages.has(stage)) return;
	seenStages.add(stage);
	push({ kind: "boot", stage, atMs: performance.now() });
};

export const perfNow = (): number => performance.now();

const percentile = (sorted: number[], p: number): number =>
	sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;

const report = (): MethodStats[] => {
	const byMethod = new Map<string, number[]>();
	for (const entry of entries) {
		if (entry.kind !== "request") continue;
		const arr = byMethod.get(entry.method) ?? [];
		arr.push(entry.durationMs);
		byMethod.set(entry.method, arr);
	}

	const stats: MethodStats[] = [...byMethod.entries()]
		.map(([method, durations]) => {
			const sorted = [...durations].sort((a, b) => a - b);
			const sum = sorted.reduce((a, b) => a + b, 0);
			return {
				method,
				count: sorted.length,
				p50: Math.round(percentile(sorted, 0.5)),
				p95: Math.round(percentile(sorted, 0.95)),
				max: Math.round(sorted[sorted.length - 1] ?? 0),
				avg: Math.round(sum / sorted.length),
			};
		})
		.sort((a, b) => b.p50 - a.p50);

	console.table(stats);
	return stats;
};

const timeAt = (entry: PerfEntry): number =>
	entry.kind === "request" ? entry.startMs : entry.atMs;

const timeline = (): Array<Record<string, unknown>> => {
	const rows = [...entries]
		.sort((a, b) => timeAt(a) - timeAt(b))
		.map((entry) =>
			entry.kind === "request"
				? {
						t: Math.round(entry.startMs),
						event: entry.method,
						durationMs: Math.round(entry.durationMs),
						ok: entry.ok,
					}
				: {
						t: Math.round(entry.atMs),
						event: `⟦boot⟧ ${entry.stage}`,
						durationMs: "",
						ok: "",
					},
		);

	console.table(rows);
	return rows;
};

const reset = (): void => {
	entries.length = 0;
	seenStages.clear();
};

if (typeof window !== "undefined") {
	window.__colibriPerf = {
		report,
		timeline,
		reset,
		entries: () => [...entries],
	};
}
