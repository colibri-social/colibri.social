/**
 * Publishes all Colibri lexicons to the AT Protocol network.
 *
 * Required environment variables:
 *   LEXICON_PDS        - PDS URL, e.g. https://bsky.social
 *   LEXICON_HANDLE     - Handle to authenticate with, e.g. colibri.social
 *   LEXICON_PASSWORD   - App password for the account
 *
 * Usage:
 *   pnpm publish-lexicons
 */

import { AtpAgent } from "@atproto/api";
import { LEXICON_DOCS } from "../src/utils/atproto/lexicons.ts";

const pds = process.env.LEXICON_PDS;
const handle = process.env.LEXICON_HANDLE;
const password = process.env.LEXICON_PASSWORD;

if (!pds || !handle || !password) {
	console.error(
		"Missing required environment variables: LEXICON_PDS, LEXICON_HANDLE, LEXICON_PASSWORD",
	);
	process.exit(1);
}

const agent = new AtpAgent({ service: pds });

await agent.login({ identifier: handle, password });

console.log(`Logged in as ${agent.session?.did}\n`);

for (const doc of LEXICON_DOCS) {
	const rkey = doc.id;
	const record = {
		$type: "com.atproto.lexicon.schema",
		...doc,
	};

	// Check if the record already exists so we can put (update) instead of create.
	let exists = false;
	try {
		await agent.api.com.atproto.repo.getRecord({
			repo: agent.session!.did,
			collection: "com.atproto.lexicon.schema",
			rkey,
		});
		exists = true;
	} catch {
		// Record does not exist yet.
	}

	if (exists) {
		await agent.api.com.atproto.repo.putRecord({
			repo: agent.session!.did,
			collection: "com.atproto.lexicon.schema",
			rkey,
			record,
		});
		console.log(`  updated  ${rkey}`);
	} else {
		await agent.api.com.atproto.repo.createRecord({
			repo: agent.session!.did,
			collection: "com.atproto.lexicon.schema",
			rkey,
			record,
		});
		console.log(`  created  ${rkey}`);
	}
}

console.log(`\nDone. Published ${LEXICON_DOCS.length} lexicon(s).`);
