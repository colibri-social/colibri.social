import { createSignal } from "solid-js";

export const categoryCollapseKey = (space: string, category: string) =>
	`colibri:category-collapsed:${space}:${category}`;

const readCollapsed = (key: string) => {
	try {
		return localStorage.getItem(key) === "1";
	} catch {
		return false;
	}
};

const writeCollapsed = (key: string, collapsed: boolean) => {
	try {
		if (collapsed) localStorage.setItem(key, "1");
		else localStorage.removeItem(key);
	} catch {}
};

export const createCategoryCollapse = () => {
	const [state, setState] = createSignal<Readonly<Record<string, boolean>>>({});
	return {
		collapsed: (space: string, category: string) => {
			const key = categoryCollapseKey(space, category);
			const known = state()[key];
			return known ?? readCollapsed(key);
		},
		setCollapsed: (space: string, category: string, collapsed: boolean) => {
			const key = categoryCollapseKey(space, category);
			setState((current) => ({ ...current, [key]: collapsed }));
			writeCollapsed(key, collapsed);
		},
	};
};
