export type ChannelLayoutCategory = {
	id: string;
	channels: string[];
};

export type ChannelLayout = {
	uncategorized: string[];
	categories: ChannelLayoutCategory[];
};

export type ChannelSlot = {
	categoryId: string | null;
	index: number;
};

export type ChannelReorder =
	| {
			type: "channel";
			id: string;
			from: ChannelSlot;
			to: ChannelSlot;
			layout: ChannelLayout;
	  }
	| {
			type: "category";
			id: string;
			from: number;
			to: number;
			layout: ChannelLayout;
	  };

const clamp = (value: number, min: number, max: number) =>
	Math.max(min, Math.min(max, value));

export const channelsIn = (
	layout: ChannelLayout,
	categoryId: string | null,
): readonly string[] =>
	categoryId === null
		? layout.uncategorized
		: (layout.categories.find((category) => category.id === categoryId)
				?.channels ?? []);

export const findChannel = (
	layout: ChannelLayout,
	id: string,
): ChannelSlot | undefined => {
	const loose = layout.uncategorized.indexOf(id);
	if (loose >= 0) return { categoryId: null, index: loose };
	for (const category of layout.categories) {
		const index = category.channels.indexOf(id);
		if (index >= 0) return { categoryId: category.id, index };
	}
	return undefined;
};

export const findCategory = (layout: ChannelLayout, id: string) =>
	layout.categories.findIndex((category) => category.id === id);

const without = (list: readonly string[], id: string) =>
	list.filter((entry) => entry !== id);

export const placeChannel = (
	layout: ChannelLayout,
	id: string,
	slot: ChannelSlot,
): ChannelLayout => {
	const insert = (list: readonly string[]) => {
		const next = without(list, id);
		next.splice(clamp(slot.index, 0, next.length), 0, id);
		return next;
	};
	return {
		uncategorized:
			slot.categoryId === null
				? insert(layout.uncategorized)
				: without(layout.uncategorized, id),
		categories: layout.categories.map((category) => ({
			id: category.id,
			channels:
				category.id === slot.categoryId
					? insert(category.channels)
					: without(category.channels, id),
		})),
	};
};

export const placeCategory = (
	layout: ChannelLayout,
	id: string,
	index: number,
): ChannelLayout => {
	const from = findCategory(layout, id);
	if (from < 0) return layout;
	const categories = [...layout.categories];
	const [moved] = categories.splice(from, 1);
	categories.splice(clamp(index, 0, categories.length), 0, moved);
	return { uncategorized: [...layout.uncategorized], categories };
};

export const stepChannel = (
	layout: ChannelLayout,
	id: string,
	delta: number,
): ChannelSlot | undefined => {
	const current = findChannel(layout, id);
	if (!current) return undefined;
	const groups: (string | null)[] = [
		null,
		...layout.categories.map((category) => category.id),
	];
	const group = groups.indexOf(current.categoryId);
	const siblings = channelsIn(layout, current.categoryId).length - 1;
	const index = current.index + delta;
	if (index >= 0 && index <= siblings)
		return { categoryId: current.categoryId, index };
	const neighbour = groups[group + Math.sign(delta)];
	if (neighbour === undefined) return undefined;
	return {
		categoryId: neighbour,
		index: delta > 0 ? 0 : channelsIn(layout, neighbour).length,
	};
};

export const edgeChannel = (
	layout: ChannelLayout,
	id: string,
	edge: "start" | "end",
): ChannelSlot | undefined => {
	const current = findChannel(layout, id);
	if (!current) return undefined;
	const last = channelsIn(layout, current.categoryId).length - 1;
	const index = edge === "start" ? 0 : last;
	return index === current.index
		? undefined
		: { categoryId: current.categoryId, index };
};

export const sameSlot = (a: ChannelSlot, b: ChannelSlot) =>
	a.categoryId === b.categoryId && a.index === b.index;

const sameList = (a: readonly string[], b: readonly string[]) =>
	a.length === b.length && a.every((entry, index) => entry === b[index]);

export const sameLayout = (a: ChannelLayout, b: ChannelLayout) =>
	sameList(a.uncategorized, b.uncategorized) &&
	a.categories.length === b.categories.length &&
	a.categories.every(
		(category, index) =>
			category.id === b.categories[index].id &&
			sameList(category.channels, b.categories[index].channels),
	);

export const reconcileLayout = (
	candidate: ChannelLayout,
	actual: ChannelLayout,
): ChannelLayout => {
	const home = new Map<string, string | null>();
	for (const id of actual.uncategorized) home.set(id, null);
	for (const category of actual.categories)
		for (const id of category.channels) home.set(id, category.id);

	const actualCategories = new Set(actual.categories.map((entry) => entry.id));
	const placed = new Set<string>();
	const keep = (list: readonly string[]) =>
		list.filter((id) => {
			if (!home.has(id) || placed.has(id)) return false;
			placed.add(id);
			return true;
		});

	const uncategorized = keep(candidate.uncategorized);
	const groups = new Map<string, string[]>();
	const order: string[] = [];
	for (const category of candidate.categories) {
		if (!actualCategories.has(category.id) || groups.has(category.id)) continue;
		groups.set(category.id, keep(category.channels));
		order.push(category.id);
	}
	actual.categories.forEach((category, index) => {
		if (groups.has(category.id)) return;
		groups.set(category.id, []);
		order.splice(Math.min(index, order.length), 0, category.id);
	});

	for (const [id, categoryId] of home) {
		if (placed.has(id)) continue;
		const list = categoryId === null ? uncategorized : groups.get(categoryId);
		list?.push(id);
	}

	return {
		uncategorized,
		categories: order.map((id) => ({ id, channels: groups.get(id) ?? [] })),
	};
};

export const positionText = (
	index: number,
	total: number,
	categoryName?: string,
) =>
	categoryName === undefined
		? `position ${index + 1} of ${total} outside any category`
		: `position ${index + 1} of ${total} in ${categoryName}`;
