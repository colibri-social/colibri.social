import { readdirSync, readFileSync } from "node:fs";

const SOLAR_BOLD_DIR = new URL(
	"../../packages/app/node_modules/@solar-icons/solid/dist/icons/bold/",
	import.meta.url,
);

const MODULE_SUFFIX = ".mjs";

export const ICON_VIEWBOX = "0 0 24 24";

const iconNames = new Set(
	readdirSync(SOLAR_BOLD_DIR)
		.filter((file) => file.endsWith(MODULE_SUFFIX))
		.map((file) => file.slice(0, -MODULE_SUFFIX.length)),
);

const readModule = (name: string) => {
	return readFileSync(new URL(`${name}${MODULE_SUFFIX}`, SOLAR_BOLD_DIR), "utf8");
};

export const iconExists = (name: string): boolean => {
	return iconNames.has(name);
};

export const iconProblem = (name: string): string | undefined => {
	return iconExists(name) ? undefined : `unknown icon "${name}"`;
};

export const iconBody = (name: string): string | undefined => {
	if (!iconExists(name)) return undefined;

	return /iconBody:`([^`]*)`/.exec(readModule(name))?.[1];
};

export const iconExportName = (name: string): string | undefined => {
	if (!iconExists(name)) return undefined;

	return /export\{\w+ as (\w+)\}/.exec(readModule(name))?.[1];
};

export interface IconSearchResult {
	matches: string[];
	total: number;
}

export const searchIcons = (term: string, limit = 12): IconSearchResult => {
	const needle = term.trim().toLowerCase();

	if (!needle) return { matches: [], total: 0 };

	const scored: Array<{ name: string; score: number }> = [];

	for (const name of iconNames) {
		const index = name.indexOf(needle);

		if (index === -1) continue;

		scored.push({ name, score: name === needle ? 0 : index === 0 ? 1 : 2 });
	}

	scored.sort(
		(a, b) =>
			a.score - b.score ||
			a.name.length - b.name.length ||
			a.name.localeCompare(b.name),
	);

	return {
		matches: scored.slice(0, limit).map((entry) => entry.name),
		total: scored.length,
	};
};
