import type {
	LexiconDoc,
	LexXrpcProcedure,
	LexXrpcQuery,
} from "@atproto/lexicon";
import { describe, expect, it } from "vitest";
import { LEXICON_DOCS, lexicon } from "./index.ts";
import { readWrapperCalls, type WrapperCall } from "./wrapper-calls.ts";

/**
 * Methods that legitimately have no output schema, with the reason. Anything
 * not listed here must declare one: `assertValidXrpcOutput` returns quietly
 * when a schema is absent, so an undeclared output turns every validation of
 * that method into a silent pass.
 */
const SCHEMALESS_METHODS: Record<string, string> = {
	"social.colibri.sync.sendHum": "Fire and forget, no output key at all.",
	"social.colibri.embed.getImage": "Streams bytes, encoding is */*.",
};

/**
 * Verified out of band, never declared as a lexicon parameter. The AppView
 * lifts it out of the `Authorization` header into the query its handlers read.
 */
const OUT_OF_BAND_PARAMS = new Set(["auth"]);

const METHOD_TYPES = new Set(["query", "procedure"]);

const methodDocs = LEXICON_DOCS.filter((doc) =>
	METHOD_TYPES.has(doc.defs.main?.type ?? ""),
);

const mainOf = (doc: LexiconDoc) =>
	doc.defs.main as LexXrpcQuery | LexXrpcProcedure;

const localCalls = readWrapperCalls().filter((call) =>
	call.nsid.startsWith("social.colibri."),
);

const docFor = (nsid: string) =>
	LEXICON_DOCS.find((doc) => doc.id === nsid) as LexiconDoc | undefined;

const declaredParams = (call: WrapperCall): Set<string> => {
	const doc = docFor(call.nsid);
	if (!doc) return new Set();
	return new Set(Object.keys(mainOf(doc).parameters?.properties ?? {}));
};

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

describe("client wrappers", () => {
	it("are actually found on disk", () => {
		expect(localCalls.length).toBeGreaterThanOrEqual(55);
	});

	it("make exactly one XRPC call each", () => {
		const seen = new Map<string, number>();
		for (const call of readWrapperCalls())
			seen.set(call.file, (seen.get(call.file) ?? 0) + 1);

		expect([...seen].filter(([, count]) => count !== 1)).toEqual([]);
	});

	it("call methods the lexicons define", () => {
		const undefinedMethods = localCalls
			.filter((call) => !docFor(call.nsid))
			.map((call) => `${call.file} → ${call.nsid}`);

		expect(undefinedMethods).toEqual([]);
	});

	it("agree with the lexicon on the HTTP verb", () => {
		const disagreements = localCalls
			.filter((call) => {
				const doc = docFor(call.nsid);
				if (!doc) return false;
				const expected = mainOf(doc).type === "procedure" ? "post" : "get";
				return call.method !== expected;
			})
			.map((call) => `${call.nsid} sent as ${call.method.toUpperCase()}`);

		expect(disagreements).toEqual([]);
	});

	it("only send parameters the lexicon declares", () => {
		const undeclared: Array<string> = [];

		for (const call of localCalls) {
			if (!docFor(call.nsid)) continue;
			const declared = declaredParams(call);

			for (const param of call.params)
				if (!declared.has(param) && !OUT_OF_BAND_PARAMS.has(param))
					undeclared.push(`${call.nsid} sends undeclared "${param}"`);
		}

		expect(undeclared).toEqual([]);
	});

	it("always send every required parameter", () => {
		const missing: Array<string> = [];

		for (const call of localCalls) {
			const doc = docFor(call.nsid);
			if (!doc) continue;

			const sent = new Set(call.params);
			for (const param of mainOf(doc).parameters?.required ?? [])
				if (!sent.has(param))
					missing.push(`${call.nsid} never sends required "${param}"`);
		}

		expect(missing).toEqual([]);
	});
});
