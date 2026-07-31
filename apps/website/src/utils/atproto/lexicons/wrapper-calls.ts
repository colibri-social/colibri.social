import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const WRAPPER_ROOT = fileURLToPath(
	new URL(
		"../../../../../../packages/client/src/atproto/xrpc",
		import.meta.url,
	),
);

export type WrapperCall = {
	file: string;
	nsid: string;
	method: "get" | "post";
	params: Array<string>;
};

const sourceFiles = (dir: string): Array<string> => {
	const found: Array<string> = [];

	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) {
			found.push(...sourceFiles(path));
			continue;
		}
		if (!entry.endsWith(".ts")) continue;
		if (entry === "index.ts" || entry.endsWith(".test.ts")) continue;
		found.push(path);
	}

	return found;
};

const balancedCall = (source: string, open: number): string | undefined => {
	let depth = 0;

	for (let i = open; i < source.length; i += 1) {
		if (source[i] === "(") depth += 1;
		else if (source[i] === ")") {
			depth -= 1;
			if (depth === 0) return source.slice(open, i + 1);
		}
	}

	return undefined;
};

const routeOf = (call: string): string | undefined =>
	call.match(/["'`]\/xrpc\/([^"'`?$]+)/)?.[1];

const queryParamsOf = (source: string): Array<string> => {
	const params = new Set<string>();

	for (const match of source.matchAll(/[?&]([a-zA-Z0-9_]+)=\$\{/g))
		params.add(match[1]);
	for (const match of source.matchAll(/params\.(?:set|append)\(\s*"([^"]+)"/g))
		params.add(match[1]);
	for (const match of source.matchAll(/new URLSearchParams\(\{([^}]*)\}/g))
		for (const key of match[1].split(","))
			if (key.trim()) params.add(key.split(":")[0].trim());

	return [...params].sort();
};

const lxmOf = (call: string): string | undefined =>
	call.match(/lxm:\s*["'`]([^"'`]+)["'`]/)?.[1];

/**
 * Reads every XRPC wrapper in the client package and reports the call it
 * makes. Each wrapper issues a single request for a single route, which the
 * `one_call_per_wrapper` assertion keeps true.
 *
 * Colibri wrappers go through the shared `request()` helper and name their
 * method in `lxm`; the handful that talk to the public Bluesky AppView still
 * call `fetch` directly, so both shapes are recognised.
 */
export const readWrapperCalls = (): Array<WrapperCall> => {
	const calls: Array<WrapperCall> = [];

	for (const file of sourceFiles(WRAPPER_ROOT)) {
		const source = readFileSync(file, "utf8");
		const params = queryParamsOf(source);
		const seen = new Set<string>();

		const record = (call: string, nsid: string | undefined): void => {
			if (!nsid || seen.has(nsid)) return;
			seen.add(nsid);
			calls.push({
				file: relative(WRAPPER_ROOT, file),
				nsid,
				method: /method:\s*"POST"/.test(call) ? "post" : "get",
				params,
			});
		};

		for (const match of source.matchAll(/\brequest(?:<[\s\S]*?>)?\(/g)) {
			const call = balancedCall(source, match.index + match[0].length - 1);
			if (!call) continue;
			record(call, lxmOf(call) ?? routeOf(call));
		}

		for (const match of source.matchAll(/\bfetch\(/g)) {
			const call = balancedCall(source, match.index + "fetch".length);
			if (!call) continue;
			record(call, routeOf(call));
		}
	}

	return calls;
};
