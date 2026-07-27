import { createRequire } from "node:module";

const requireFromClient = createRequire(
	new URL("../../packages/client/package.json", import.meta.url),
);

interface IconSet {
	width: number;
	height: number;
	icons: Record<string, { body: string }>;
	aliases?: Record<string, { parent: string }>;
}

const iconSet = requireFromClient("@iconify-json/ph/icons.json") as IconSet;

export const FILL_SUFFIX = "-fill";

export const ICON_VIEWBOX = `0 0 ${iconSet.width} ${iconSet.height}`;

const resolveName = (name: string): string | undefined => {
	if (iconSet.icons[name]) return name;
	const parent = iconSet.aliases?.[name]?.parent;
	if (parent && iconSet.icons[parent]) return parent;
	return undefined;
};

export const iconExists = (name: string): boolean =>
	resolveName(name) !== undefined;

export const iconProblem = (name: string): string | undefined => {
	if (!iconExists(name)) return `unknown icon "${name}"`;
	if (name.endsWith(FILL_SUFFIX)) return undefined;

	const fill = `${name}${FILL_SUFFIX}`;
	return iconExists(fill)
		? `icon "${name}" is not a fill variant, use "${fill}"`
		: `icon "${name}" is not a fill variant, and "${fill}" does not exist`;
};

export const iconBody = (name: string): string | undefined => {
	const resolved = resolveName(name);
	return resolved ? iconSet.icons[resolved].body : undefined;
};

const allNames = (): string[] => [
	...Object.keys(iconSet.icons),
	...Object.keys(iconSet.aliases ?? {}),
];

export interface IconSearchResult {
	matches: string[];
	total: number;
}

export const searchIcons = (term: string, limit = 12): IconSearchResult => {
	const needle = term.trim().toLowerCase().replace(/-fill$/, "");
	if (!needle) return { matches: [], total: 0 };

	const scored: Array<{ name: string; score: number }> = [];
	for (const name of allNames()) {
		if (!name.endsWith(FILL_SUFFIX)) continue;

		const base = name.slice(0, -FILL_SUFFIX.length);
		const index = base.indexOf(needle);
		if (index === -1) continue;

		scored.push({ name, score: base === needle ? 0 : index === 0 ? 1 : 2 });
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
