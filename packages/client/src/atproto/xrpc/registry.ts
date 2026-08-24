import { colibri } from "../lexicons";
import type { Method } from "./request";

const isMethod = (value: unknown): value is Method =>
	typeof value === "object" &&
	value !== null &&
	typeof (value as { nsid?: unknown }).nsid === "string" &&
	((value as { type?: unknown }).type === "query" ||
		(value as { type?: unknown }).type === "procedure");

const collect = (node: unknown, into: Map<string, Method>, depth = 0): void => {
	if (depth > 6 || typeof node !== "object" || node === null) return;

	for (const value of Object.values(node as Record<string, unknown>)) {
		if (isMethod(value)) {
			into.set(value.nsid, value);
			continue;
		}
		collect(value, into, depth + 1);
	}
};

let cache: Map<string, Method> | undefined;

const methods = (): Map<string, Method> => {
	if (!cache) {
		cache = new Map<string, Method>();
		collect(colibri, cache);
	}
	return cache;
};

export const methodByNsid = (nsid: string): Method | undefined =>
	methods().get(nsid);

export const knownMethodNsids = (): ReadonlyArray<string> => [
	...methods().keys(),
];
