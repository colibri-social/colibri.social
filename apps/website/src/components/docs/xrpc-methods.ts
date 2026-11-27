import { defElementId, type LexField } from "./lexicon-utils.ts";

type XrpcMethodKind = "query" | "procedure" | "subscription";

export type XrpcMethodDoc = {
	id: string;
	defs: Record<string, LexField>;
};

export type XrpcMethod = {
	nsid: string;
	name: string;
	anchor: string;
	kind: XrpcMethodKind;
	verb: "GET" | "POST" | "WS";
	authenticated: boolean;
	def: LexField;
};

export type ResolvedRef = {
	ref: string;
	name: string;
	href: string;
	description?: string;
};

export const LEXICONS_PAGE = "/docs/developers/specification/lexicons";

export const XRPC_PREFIXES = {
	server: "social.colibri.beta.server",
	community: "social.colibri.beta.community",
	category: "social.colibri.beta.category",
	channel: "social.colibri.beta.channel",
	thread: "social.colibri.beta.thread",
	role: "social.colibri.beta.role",
	actor: "social.colibri.beta.actor",
	notification: "social.colibri.beta.notification",
	emoji: "social.colibri.beta.emoji",
	embed: "social.colibri.beta.embed",
	blob: "social.colibri.beta.blob",
	voice: "social.colibri.beta.voice",
	sync: "social.colibri.beta.sync",
	bridge: "social.colibri.beta.bridge",
	polyfill: "social.colibri.beta.polyfill",
	federation: "social.colibri.beta.federation",
} as const;

const VERBS = {
	query: "GET",
	procedure: "POST",
	subscription: "WS",
} as const;

export const isXrpcMethod = (doc: XrpcMethodDoc) => {
	return Object.hasOwn(VERBS, doc.defs.main?.type ?? "");
};

export const isUnderPrefix = (nsid: string, prefix: string) => {
	return nsid.startsWith(`${prefix}.`);
};

const methodAnchor = (nsid: string) => {
	return nsid.replaceAll(".", "").toLowerCase();
};

export const methodsUnder = (
	docs: ReadonlyArray<XrpcMethodDoc>,
	prefix: string,
): Array<XrpcMethod> => {
	return docs
		.filter((doc) => isXrpcMethod(doc) && isUnderPrefix(doc.id, prefix))
		.map((doc) => {
			const def = doc.defs.main;
			const kind = def.type as XrpcMethodKind;
			const errors: Array<LexField> = def.errors ?? [];

			return {
				nsid: doc.id,
				name: doc.id.slice(prefix.length + 1),
				anchor: methodAnchor(doc.id),
				kind,
				verb: VERBS[kind],
				authenticated: errors.some((error) => error.name === "AuthRequired"),
				def,
			};
		});
};

export const resolveRef = (
	docs: ReadonlyArray<XrpcMethodDoc>,
	ref: string,
	currentDocId: string,
): ResolvedRef => {
	const [rawNsid, fragment = "main"] = ref.replace(/^lex:/, "").split("#");
	const nsid = rawNsid === "" ? currentDocId : rawNsid;
	const def = docs.find((doc) => doc.id === nsid)?.defs[fragment];

	return {
		ref,
		name: fragment === "main" ? nsid : fragment,
		href: `${LEXICONS_PAGE}#${defElementId(nsid, fragment)}`,
		description: def?.description,
	};
};
