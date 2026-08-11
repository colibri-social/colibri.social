import type { TrackRelease } from "./lib/play.ts";
import {
	accessToken,
	commitEdit,
	createEdit,
	done,
	fail,
	getTrack,
	putTrack,
	serviceAccount,
} from "./lib/play.ts";

const TRACK = "production";

const LADDER: Array<{ day: number; fraction: number }> = [
	{ day: 0, fraction: 0.2 },
	{ day: 1, fraction: 0.5 },
	{ day: 3, fraction: 1 },
];

const flags = new Map<string, string>();
for (const arg of process.argv.slice(2)) {
	const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
	if (match) flags.set(match[1], match[2] ?? "");
}

const dryRun = flags.has("dry-run");
const forced = flags.has("fraction") ? Number(flags.get("fraction")) : undefined;

if (forced !== undefined && !(forced > 0 && forced <= 1)) {
	console.error(`--fraction must be greater than 0 and at most 1`);
	process.exit(1);
}

const startDateOf = (name: string | undefined): Date | undefined => {
	const match = /\((\d{4}-\d{2}-\d{2})\)\s*$/.exec(name ?? "");
	if (!match) return undefined;
	const parsed = new Date(`${match[1]}T00:00:00Z`);
	return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const daysSince = (start: Date): number => {
	const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
	return Math.floor((today.getTime() - start.getTime()) / 86_400_000);
};

const targetFor = (elapsed: number): number => {
	let target = LADDER[0].fraction;
	for (const rung of LADDER) if (elapsed >= rung.day) target = rung.fraction;
	return target;
};

const token = await accessToken(serviceAccount());
const editId = await createEdit(token);

const track = await getTrack(token, editId, TRACK);
const releases = track.releases ?? [];

const rolling = releases.filter((release) => release.status === "inProgress");
if (rolling.length === 0) {
	const statuses = releases
		.map((release) => release.status ?? "unknown")
		.join(", ");
	done(
		`no in-progress release on the ${TRACK} track${statuses ? ` (found: ${statuses})` : ""}, nothing to do`,
	);
}
if (rolling.length > 1) {
	fail(
		`the ${TRACK} track has ${rolling.length} in-progress releases, refusing to guess`,
	);
}

const release = rolling[0];
const current = release.userFraction ?? 0;
const label =
	release.name ?? release.versionCodes?.join(", ") ?? "unnamed release";

let target: number;
if (forced !== undefined) {
	target = forced;
	console.log(`forcing ${label} from ${current} to ${target}`);
} else {
	const start = startDateOf(release.name);
	if (!start) {
		done(
			`release "${label}" has no (YYYY-MM-DD) start date in its name, leaving it at ${current}`,
		);
	}
	const elapsed = daysSince(start);
	target = targetFor(elapsed);
	console.log(
		`release "${label}" is at ${current}, day ${elapsed} targets ${target}`,
	);
}

if (target <= current) done(`already at or past ${target}, nothing to do`);

const updated: TrackRelease = { ...release };
if (target >= 1) {
	updated.status = "completed";
	delete updated.userFraction;
} else {
	updated.status = "inProgress";
	updated.userFraction = target;
}

if (dryRun) {
	const shape = JSON.stringify({
		status: updated.status,
		userFraction: updated.userFraction,
	});
	done(`dry run: would set ${label} to ${shape}`);
}

await putTrack(
	token,
	editId,
	TRACK,
	releases.map((entry) => (entry === release ? updated : entry)),
);

await commitEdit(token, editId);

console.log(
	updated.status === "completed"
		? `completed the rollout of ${label}`
		: `widened ${label} to ${target}`,
);
