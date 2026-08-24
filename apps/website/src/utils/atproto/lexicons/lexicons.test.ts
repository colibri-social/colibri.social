import type {
	LexiconDoc,
	LexXrpcProcedure,
	LexXrpcQuery,
} from "@atproto/lexicon";
import { describe, expect, it } from "vitest";
import { LEXICON_DOCS, lexicon } from "./index.ts";

/**
 * Methods that legitimately have no output schema, with the reason. Anything
 * not listed here must declare one: `assertValidXrpcOutput` returns quietly
 * when a schema is absent, so an undeclared output turns every validation of
 * that method into a silent pass.
 */
const SCHEMALESS_METHODS: Record<string, string> = {
	"social.colibri.beta.blob.get": "Streams bytes, encoding is */*.",
};

const METHOD_TYPES = new Set(["query", "procedure"]);

const methodDocs = LEXICON_DOCS.filter((doc) =>
	METHOD_TYPES.has(doc.defs.main?.type ?? ""),
);

const mainOf = (doc: LexiconDoc) =>
	doc.defs.main as LexXrpcQuery | LexXrpcProcedure;

const docFor = (nsid: string) =>
	LEXICON_DOCS.find((doc) => doc.id === nsid) as LexiconDoc | undefined;

const collectRefs = (node: unknown, into: Array<string>): void => {
	if (Array.isArray(node)) {
		for (const item of node) collectRefs(item, into);
		return;
	}
	if (!node || typeof node !== "object") return;

	const record = node as Record<string, unknown>;
	if (record.type === "ref" && typeof record.ref === "string")
		into.push(record.ref);
	if (record.type === "union" && Array.isArray(record.refs))
		for (const ref of record.refs) if (typeof ref === "string") into.push(ref);

	for (const value of Object.values(record)) collectRefs(value, into);
};

describe("lexicon documents", () => {
	it("resolve every ref they declare", () => {
		const unresolved: Array<string> = [];

		for (const doc of LEXICON_DOCS) {
			const refs: Array<string> = [];
			collectRefs(doc.defs, refs);

			for (const raw of refs) {
				const stripped = raw.replace(/^lex:/, "");
				const uri = stripped.startsWith("#")
					? `${doc.id}${stripped}`
					: stripped;
				if (!lexicon.getDef(uri)) unresolved.push(`${doc.id} → ${raw}`);
			}
		}

		expect(unresolved).toEqual([]);
	});

	it("declare an output schema on every method", () => {
		const missing = methodDocs
			.filter((doc) => !mainOf(doc).output?.schema)
			.map((doc) => doc.id)
			.filter((id) => !(id in SCHEMALESS_METHODS));

		expect(missing).toEqual([]);
	});

	it("keep the schemaless exemptions honest", () => {
		const stale = Object.keys(SCHEMALESS_METHODS).filter((id) => {
			const doc = docFor(id);
			return !doc || Boolean(mainOf(doc).output?.schema);
		});

		expect(stale).toEqual([]);
	});
});
