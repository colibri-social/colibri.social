import type { SandboxCategory, SandboxItem } from "../types";
import { APP } from "./app";
import { BASICS } from "./basics";
import { ERRORS } from "./errors";
import { FORMS } from "./forms";
import { ICONS } from "./icons";
import { OVERLAYS } from "./overlays";

export const CATEGORIES: Array<SandboxCategory> = [
	BASICS,
	FORMS,
	OVERLAYS,
	ICONS,
	ERRORS,
	APP,
];

export const DEFAULT_ITEM = CATEGORIES[0].items[0];

export const findItem = (id: string | null): SandboxItem | undefined => {
	if (!id) return undefined;
	for (const category of CATEGORIES) {
		const item = category.items.find((entry) => entry.id === id);
		if (item) return item;
	}
	return undefined;
};
