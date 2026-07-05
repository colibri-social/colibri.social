export type LexField = Record<string, any>;

export type LexCategory =
	| "records"
	| "shared"
	| "queries"
	| "procedures"
	| "subscriptions"
	| "permissions";

function slugify(value: string): string {
	return value.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function defElementId(docId: string, defName: string): string {
	const base = slugify(docId.replaceAll("lex:", ""));
	return defName === "main" ? base : `${base}--${slugify(defName)}`;
}

export function anchorFromRef(ref: string, currentDocId: string): string {
	const hashIndex = ref.indexOf("#");
	const nsid = ref.startsWith("#")
		? currentDocId
		: hashIndex === -1
			? ref
			: ref.slice(0, hashIndex);
	const fragment = hashIndex === -1 ? "main" : ref.slice(hashIndex + 1);
	return defElementId(nsid, fragment);
}

export function refLabel(ref: string): string {
	const [nsid, fragment] = ref.split("#");

	if (nsid === "") return fragment;

	const short = nsid.split(".").slice(-2).join(".");

	return fragment ? `${short}#${fragment}` : short;
}

export function constraintChips(
	def: LexField,
): { label: string; value: string }[] {
	const chips: { label: string; value: string }[] = [];
	const push = (label: string, value: unknown) => {
		if (value !== undefined && value !== null) {
			chips.push({ label, value: String(value) });
		}
	};

	push("format", def.format);
	push("const", def.const);
	push("default", def.default);
	if (def.enum) push("enum", def.enum.join(" | "));
	if (def.knownValues) push("known", def.knownValues.join(" | "));
	push("min", def.minimum);
	push("max", def.maximum);
	push("minLength", def.minLength);
	push("maxLength", def.maxLength);
	push("minGraphemes", def.minGraphemes);
	push("maxGraphemes", def.maxGraphemes);
	push("maxSize", def.maxSize);
	if (def.accept) push("accept", def.accept.join(", "));

	return chips;
}

export function docCategory(doc: {
	defs: Record<string, LexField>;
}): LexCategory {
	const main = doc.defs.main;
	if (!main) return "shared";
	switch (main.type) {
		case "record":
			return "records";
		case "query":
			return "queries";
		case "procedure":
			return "procedures";
		case "subscription":
			return "subscriptions";
		case "permission-set":
			return "permissions";
		default:
			return "shared";
	}
}

export function orderedDefs(doc: {
	defs: Record<string, LexField>;
}): [string, LexField][] {
	return Object.entries(doc.defs).sort(([a], [b]) =>
		a === "main" ? -1 : b === "main" ? 1 : 0,
	);
}
