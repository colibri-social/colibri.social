import { createSign } from "node:crypto";

const PACKAGE_NAME = "social.colibri.app";
const TRACK = "production";
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://androidpublisher.googleapis.com/androidpublisher/v3";

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

interface ServiceAccount {
	client_email: string;
	private_key: string;
}

interface TrackRelease {
	name?: string;
	versionCodes?: Array<string>;
	status?: string;
	userFraction?: number;
	releaseNotes?: Array<{ language: string; text: string }>;
	countryTargeting?: unknown;
	inAppUpdatePriority?: number;
}

interface Track {
	track: string;
	releases?: Array<TrackRelease>;
}

const done: (message: string) => never = (message) => {
	console.log(message);
	process.exit(0);
};

const fail: (message: string) => never = (message) => {
	console.error(`error: ${message}`);
	process.exit(1);
};

const base64url = (value: Buffer | string): string =>
	Buffer.from(value)
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");

const accessToken = async (account: ServiceAccount): Promise<string> => {
	const now = Math.floor(Date.now() / 1000);
	const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
	const claims = base64url(
		JSON.stringify({
			iss: account.client_email,
			scope: SCOPE,
			aud: TOKEN_URL,
			iat: now,
			exp: now + 3600,
		}),
	);

	const signer = createSign("RSA-SHA256");
	signer.update(`${header}.${claims}`);
	const signature = base64url(signer.sign(account.private_key));

	const response = await fetch(TOKEN_URL, {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
			assertion: `${header}.${claims}.${signature}`,
		}),
	});

	if (!response.ok) {
		return fail(
			`token request failed: ${response.status} ${await response.text()}`,
		);
	}

	const body = (await response.json()) as { access_token?: string };
	if (!body.access_token) {
		return fail("token response contained no access_token");
	}
	return body.access_token;
};

const call = async (
	token: string,
	method: string,
	path: string,
	body?: unknown,
): Promise<unknown> => {
	const response = await fetch(`${API}${path}`, {
		method,
		headers: {
			authorization: `Bearer ${token}`,
			...(body ? { "content-type": "application/json" } : {}),
		},
		...(body ? { body: JSON.stringify(body) } : {}),
	});

	if (!response.ok) {
		return fail(
			`${method} ${path} failed: ${response.status} ${await response.text()}`,
		);
	}

	const text = await response.text();
	return text ? JSON.parse(text) : {};
};

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

const raw = process.env.PLAY_SERVICE_ACCOUNT_JSON;
if (!raw) fail("PLAY_SERVICE_ACCOUNT_JSON is not set");

let account: ServiceAccount;
try {
	account = JSON.parse(raw) as ServiceAccount;
} catch (error) {
	fail(
		`PLAY_SERVICE_ACCOUNT_JSON is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
	);
}

const token = await accessToken(account);

const edit = (await call(
	token,
	"POST",
	`/applications/${PACKAGE_NAME}/edits`,
)) as { id?: string };
const editId = edit.id ?? fail("Play returned an edit without an id");
const trackPath = `/applications/${PACKAGE_NAME}/edits/${editId}/tracks/${TRACK}`;

const track = (await call(token, "GET", trackPath)) as Track;
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

await call(token, "PUT", trackPath, {
	track: TRACK,
	releases: releases.map((entry) => (entry === release ? updated : entry)),
});

await call(token, "POST", `/applications/${PACKAGE_NAME}/edits/${editId}:commit`);

console.log(
	updated.status === "completed"
		? `completed the rollout of ${label}`
		: `widened ${label} to ${target}`,
);
