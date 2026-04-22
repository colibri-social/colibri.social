export type AT_URI<T extends string> =
	`at://did:${"web" | "plc"}:${string}/${T}/${string}`;
