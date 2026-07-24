import { TURSO_AUTH_TOKEN, TURSO_DATABASE_URL } from "astro:env/server";
import { type Client, createClient } from "@libsql/client";

let client: Client | undefined;
let ready: Promise<void> | undefined;

const getClient = (): Client | null => {
	if (!TURSO_DATABASE_URL) return null;
	if (!client) {
		client = createClient({
			url: TURSO_DATABASE_URL,
			authToken: TURSO_AUTH_TOKEN,
		});
	}
	return client;
};

const ensureSchema = (db: Client): Promise<void> => {
	if (!ready) {
		ready = db
			.execute(
				`CREATE TABLE IF NOT EXISTS waitlist (
					did TEXT PRIMARY KEY,
					handle TEXT,
					email TEXT NOT NULL,
					created_at TEXT NOT NULL
				)`,
			)
			.then(() => undefined);
	}
	return ready;
};

export interface WaitlistEntry {
	did: string;
	handle?: string;
	email: string;
}

export const addToWaitlist = async (
	entry: WaitlistEntry,
): Promise<"stored" | "exists" | "unavailable"> => {
	const db = getClient();
	if (!db) return "unavailable";

	await ensureSchema(db);

	const existing = await db.execute({
		sql: `SELECT 1 FROM waitlist WHERE did = ? LIMIT 1`,
		args: [entry.did],
	});
	const alreadyOnList = existing.rows.length > 0;

	await db.execute({
		sql: `INSERT INTO waitlist (did, handle, email, created_at)
			VALUES (?, ?, ?, ?)
			ON CONFLICT(did) DO UPDATE SET
				handle = excluded.handle,
				email = excluded.email`,
		args: [
			entry.did,
			entry.handle ?? null,
			entry.email,
			new Date().toISOString(),
		],
	});

	return alreadyOnList ? "exists" : "stored";
};
