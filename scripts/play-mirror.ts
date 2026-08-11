import { readFile } from "node:fs/promises";
import type { TrackRelease, TrackReleaseNote } from "./lib/play.ts";
import {
	accessToken,
	commitEdit,
	createEdit,
	done,
	fail,
	findTrack,
	getTrack,
	maxVersionCode,
	putTrack,
	serviceAccount,
} from "./lib/play.ts";

const flags = new Map<string, string>();
for (const arg of process.argv.slice(2)) {
	const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
	if (match) flags.set(match[1], match[2] ?? "");
}

const dryRun = flags.has("dry-run");
const from = flags.get("from") || "production";
const language = flags.get("language") || "en-US";
const notesFile = flags.get("notes");
const wanted = flags.has("version-code")
	? Number(flags.get("version-code"))
	: undefined;

const targets = [
	...new Set(
		(flags.get("to") ?? "alpha,beta")
			.split(",")
			.map((track) => track.trim())
			.filter((track) => track.length > 0),
	),
];

if (targets.length === 0) fail("--to listed no tracks");
if (targets.includes(from)) {
	fail(`--to may not contain the source track ${from}`);
}
if (wanted !== undefined && !Number.isInteger(wanted)) {
	fail("--version-code must be an integer");
}

const codeOf = (release: TrackRelease): number => maxVersionCode([release]);

const labelOf = (release: TrackRelease): string =>
	release.name ?? release.versionCodes?.join(", ") ?? "unnamed release";

const pickRelease = (releases: Array<TrackRelease>): TrackRelease => {
	const candidates = releases.filter(
		(release) => (release.versionCodes ?? []).length > 0,
	);

	if (candidates.length === 0) {
		fail(`the ${from} track has no release with version codes`);
	}

	if (wanted !== undefined) {
		const match = candidates.find((release) =>
			(release.versionCodes ?? []).some((code) => Number(code) === wanted),
		);
		return (
			match ??
			fail(`the ${from} track has no release with version code ${wanted}`)
		);
	}

	const rolling = candidates.filter(
		(release) => release.status === "inProgress",
	);
	const pool = rolling.length === 1 ? rolling : candidates;
	return [...pool].sort((left, right) => codeOf(right) - codeOf(left))[0];
};

const readNotes = async (): Promise<Array<TrackReleaseNote> | undefined> => {
	if (!notesFile) return undefined;
	const text = (await readFile(notesFile, "utf8")).trim();
	return text ? [{ language, text }] : undefined;
};

const token = await accessToken(serviceAccount());
const editId = await createEdit(token);

const source = await getTrack(token, editId, from);
const release = pickRelease(source.releases ?? []);
const versionCodes = release.versionCodes ?? [];
const code = codeOf(release);
const label = labelOf(release);

const notes = (await readNotes()) ?? release.releaseNotes;

const mirrored: TrackRelease = {
	...(release.name ? { name: release.name } : {}),
	versionCodes,
	status: "completed",
	...(notes ? { releaseNotes: notes } : {}),
	...(release.inAppUpdatePriority !== undefined
		? { inAppUpdatePriority: release.inAppUpdatePriority }
		: {}),
};

const pending: Array<string> = [];
for (const target of targets) {
	const existing = maxVersionCode(
		(await findTrack(token, editId, target))?.releases ?? [],
	);

	if (existing > code) {
		fail(
			`the ${target} track already holds version code ${existing}, refusing to mirror ${code}`,
		);
	}
	if (existing === code) {
		console.log(
			`the ${target} track already holds version code ${code}, skipping it`,
		);
		continue;
	}

	pending.push(target);
}

if (pending.length === 0) {
	done(`every requested track already holds version code ${code}`);
}

if (dryRun) {
	done(
		`dry run: would set ${pending.join(", ")} to ${JSON.stringify(mirrored)}`,
	);
}

for (const target of pending) {
	await putTrack(token, editId, target, [mirrored]);
}

await commitEdit(token, editId);

console.log(`mirrored ${label} from ${from} to ${pending.join(", ")}`);
