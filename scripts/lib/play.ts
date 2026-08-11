import { createSign } from "node:crypto";

const SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://androidpublisher.googleapis.com/androidpublisher/v3";

export const PACKAGE_NAME = "social.colibri.app";

export interface ServiceAccount {
	client_email: string;
	private_key: string;
}

export interface TrackReleaseNote {
	language: string;
	text: string;
}

export interface TrackRelease {
	name?: string;
	versionCodes?: Array<string>;
	status?: string;
	userFraction?: number;
	releaseNotes?: Array<TrackReleaseNote>;
	countryTargeting?: unknown;
	inAppUpdatePriority?: number;
}

export interface Track {
	track: string;
	releases?: Array<TrackRelease>;
}

export const done: (message: string) => never = (message) => {
	console.log(message);
	process.exit(0);
};

export const fail: (message: string) => never = (message) => {
	console.error(`error: ${message}`);
	process.exit(1);
};

const base64url = (value: Buffer | string): string =>
	Buffer.from(value)
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");

export const serviceAccount = (): ServiceAccount => {
	const raw = process.env.PLAY_SERVICE_ACCOUNT_JSON;
	if (!raw) fail("PLAY_SERVICE_ACCOUNT_JSON is not set");

	try {
		return JSON.parse(raw) as ServiceAccount;
	} catch (error) {
		return fail(
			`PLAY_SERVICE_ACCOUNT_JSON is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
};

export const accessToken = async (
	account: ServiceAccount,
): Promise<string> => {
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

interface ApiResponse {
	ok: boolean;
	status: number;
	text: string;
}

const request = async (
	token: string,
	method: string,
	path: string,
	body?: unknown,
): Promise<ApiResponse> => {
	const response = await fetch(`${API}${path}`, {
		method,
		headers: {
			authorization: `Bearer ${token}`,
			...(body ? { "content-type": "application/json" } : {}),
		},
		...(body ? { body: JSON.stringify(body) } : {}),
	});

	return {
		ok: response.ok,
		status: response.status,
		text: await response.text(),
	};
};

export const call = async (
	token: string,
	method: string,
	path: string,
	body?: unknown,
): Promise<unknown> => {
	const response = await request(token, method, path, body);

	if (!response.ok) {
		return fail(
			`${method} ${path} failed: ${response.status} ${response.text}`,
		);
	}

	return response.text ? JSON.parse(response.text) : {};
};

const editsPath = `/applications/${PACKAGE_NAME}/edits`;

export const createEdit = async (token: string): Promise<string> => {
	const edit = (await call(token, "POST", editsPath)) as { id?: string };
	return edit.id ?? fail("Play returned an edit without an id");
};

export const commitEdit = async (
	token: string,
	editId: string,
): Promise<void> => {
	const path = `${editsPath}/${editId}:commit`;
	const first = await request(token, "POST", path);
	if (first.ok) return;

	if (!first.text.includes("changesNotSentForReview")) {
		fail(`POST ${path} failed: ${first.status} ${first.text}`);
	}

	console.log(
		"commit rejected because changes are awaiting review, retrying with changesNotSentForReview",
	);
	const retry = await request(
		token,
		"POST",
		`${path}?changesNotSentForReview=true`,
	);
	if (!retry.ok) {
		fail(`POST ${path} failed: ${retry.status} ${retry.text}`);
	}
};

const trackPath = (editId: string, track: string): string =>
	`${editsPath}/${editId}/tracks/${track}`;

export const getTrack = async (
	token: string,
	editId: string,
	track: string,
): Promise<Track> =>
	(await call(token, "GET", trackPath(editId, track))) as Track;

export const findTrack = async (
	token: string,
	editId: string,
	track: string,
): Promise<Track | undefined> => {
	const path = trackPath(editId, track);
	const response = await request(token, "GET", path);

	if (response.status === 404) return undefined;
	if (!response.ok) {
		return fail(`GET ${path} failed: ${response.status} ${response.text}`);
	}

	return JSON.parse(response.text) as Track;
};

export const putTrack = async (
	token: string,
	editId: string,
	track: string,
	releases: Array<TrackRelease>,
): Promise<void> => {
	await call(token, "PUT", trackPath(editId, track), { track, releases });
};

export const maxVersionCode = (releases: Array<TrackRelease>): number => {
	const codes = releases
		.flatMap((release) => release.versionCodes ?? [])
		.map((code) => Number(code))
		.filter((code) => Number.isFinite(code));

	return codes.length > 0 ? Math.max(...codes) : 0;
};
