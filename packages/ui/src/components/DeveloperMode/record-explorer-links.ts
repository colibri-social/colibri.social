import { createSignal } from "solid-js";

export const RECORD_EXPLORER_IDS = ["pdsls", "atprotoAt"] as const;

export type RecordExplorer = (typeof RECORD_EXPLORER_IDS)[number];

export type RecordExplorerChoice = RecordExplorer | "custom";

export type ExplorerTemplateProblem =
	| "empty"
	| "invalidUrl"
	| "unsupportedProtocol"
	| "missingIdentifier"
	| "unknownPlaceholder";

export type RecordParts = {
	uri: string;
	authority: string;
	spaceType: string;
	spaceKey: string;
	repo: string;
	collection: string;
	rkey: string;
};

type ExplorerHref = {
	(
		value: `did:${string}` | `at://${string}`,
		explorer?: RecordExplorerChoice,
	): string;
	(
		value: string | undefined,
		explorer?: RecordExplorerChoice,
	): string | undefined;
};

type ExplorerLink = {
	name: string;
	href: (uri: string) => string;
};

export const RECORD_EXPLORER_LINKS: Record<RecordExplorer, ExplorerLink> = {
	pdsls: {
		name: "PDSls",
		href: (uri) => `https://pdsls.dev/${uri}`,
	},
	atprotoAt: {
		name: "atproto.at",
		href: (uri) => `https://atproto.at/uri/${uri.replace(/^at:\/\//, "")}`,
	},
};

export const EXPLORER_TEMPLATE_PLACEHOLDERS = [
	"uri",
	"uri:bare",
	"authority",
	"spaceType",
	"spaceKey",
	"repo",
	"collection",
	"rkey",
] as const;

const IDENTIFIER_PLACEHOLDERS = [
	"{uri}",
	"{uri:bare}",
	"{authority}",
	"{repo}",
];

const PLACEHOLDER_PATTERN = /\{([^{}]*)\}/g;

const SAMPLE_PARTS: RecordParts = {
	uri: "at://did:plc:sample/social.colibri.sample/sample",
	authority: "did:plc:sample",
	spaceType: "",
	spaceKey: "",
	repo: "did:plc:sample",
	collection: "social.colibri.sample",
	rkey: "sample",
};

const [activeExplorer, setActiveExplorer] =
	createSignal<RecordExplorerChoice>("pdsls");

const [customTemplate, setCustomTemplate] = createSignal("");

const isPlaceholder = (name: string) => {
	return (EXPLORER_TEMPLATE_PLACEHOLDERS as readonly string[]).includes(name);
};

const placeholderValue = (name: string, parts: RecordParts) => {
	if (name === "uri:bare") return parts.uri.replace(/^at:\/\//, "");

	if (!isPlaceholder(name)) return "";

	return parts[name as keyof RecordParts];
};

const EMPTY = "\u0000";

const substitute = (template: string, parts: RecordParts) => {
	return template
		.trim()
		.replace(
			PLACEHOLDER_PATTERN,
			(_, name: string) => placeholderValue(name, parts) || EMPTY,
		)
		.replaceAll(`/${EMPTY}`, "")
		.replaceAll(EMPTY, "");
};

export const explorerTemplateProblem = (
	template: string,
): ExplorerTemplateProblem | undefined => {
	const trimmed = template.trim();

	if (!trimmed) return "empty";

	const names = [...trimmed.matchAll(PLACEHOLDER_PATTERN)].map(
		(match) => match[1] ?? "",
	);

	if (names.some((name) => !isPlaceholder(name))) return "unknownPlaceholder";

	if (!IDENTIFIER_PLACEHOLDERS.some((token) => trimmed.includes(token))) {
		return "missingIdentifier";
	}

	let url: URL;

	try {
		url = new URL(substitute(trimmed, SAMPLE_PARTS));
	} catch {
		return "invalidUrl";
	}

	if (url.protocol !== "https:" && url.protocol !== "http:") {
		return "unsupportedProtocol";
	}

	return undefined;
};

export const expandExplorerTemplate = (
	template: string,
	parts: RecordParts,
) => {
	if (explorerTemplateProblem(template)) return undefined;

	return new URL(substitute(template, parts)).toString();
};

export const explorerTemplateHost = (template: string) => {
	if (explorerTemplateProblem(template)) return undefined;

	return new URL(substitute(template, SAMPLE_PARTS)).hostname;
};

export const resolveRecordExplorer = (
	explorer: RecordExplorerChoice = activeExplorer(),
): RecordExplorerChoice => {
	if (explorer !== "custom") return explorer;

	return explorerTemplateHost(customTemplate()) ? "custom" : "pdsls";
};

export const isRecordExplorer = (value: unknown): value is RecordExplorer => {
	return (
		typeof value === "string" &&
		(RECORD_EXPLORER_IDS as readonly string[]).includes(value)
	);
};

export const isRecordExplorerChoice = (
	value: unknown,
): value is RecordExplorerChoice => {
	return value === "custom" || isRecordExplorer(value);
};

export const recordExplorer = () => {
	return resolveRecordExplorer();
};

export const setRecordExplorer = (explorer: RecordExplorerChoice) => {
	setActiveExplorer(explorer);
};

export const setCustomRecordExplorerTemplate = (template: string) => {
	setCustomTemplate(template);
};

export const recordExplorerName = (explorer = activeExplorer()) => {
	const resolved = resolveRecordExplorer(explorer);

	if (resolved === "custom") {
		return explorerTemplateHost(customTemplate()) ?? "custom explorer";
	}

	return RECORD_EXPLORER_LINKS[resolved].name;
};

export const showInExplorerLabel = (explorer = activeExplorer()) => {
	return `Show on ${recordExplorerName(explorer)}`;
};

export const recordPartsOf = (value: string): RecordParts | undefined => {
	if (value.startsWith("did:")) {
		return {
			uri: `at://${value}`,
			authority: value,
			spaceType: "",
			spaceKey: "",
			repo: value,
			collection: "",
			rkey: "",
		};
	}

	if (!value.startsWith("at://")) return undefined;

	const segments = value.slice("at://".length).split("/");
	const [authority = ""] = segments;

	if (segments[1] === "space") {
		const [, , spaceType = "", spaceKey = "", repo, collection, rkey] =
			segments;

		return {
			uri: value,
			authority,
			spaceType,
			spaceKey,
			repo: repo || authority,
			collection: collection ?? "",
			rkey: rkey ?? "",
		};
	}

	const [, collection = "", rkey = ""] = segments;

	return {
		uri: value,
		authority,
		spaceType: "",
		spaceKey: "",
		repo: authority,
		collection,
		rkey,
	};
};

const explorerHrefOf = (
	value: string | undefined,
	explorer = activeExplorer(),
) => {
	if (!value) return undefined;

	const parts = recordPartsOf(value);

	if (!parts) return undefined;

	const resolved = resolveRecordExplorer(explorer);

	if (resolved === "custom") {
		return (
			expandExplorerTemplate(customTemplate(), parts) ??
			RECORD_EXPLORER_LINKS.pdsls.href(parts.uri)
		);
	}

	return RECORD_EXPLORER_LINKS[resolved].href(parts.uri);
};

export const recordExplorerHref = explorerHrefOf as ExplorerHref;
