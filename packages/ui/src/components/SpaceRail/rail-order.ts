export const sameOrder = (a: readonly string[], b: readonly string[]) =>
	a.length === b.length && a.every((id, index) => id === b[index]);

export const reconcileOrder = (
	order: readonly string[],
	actual: readonly string[],
) => {
	const present = new Set(actual);
	const kept = order.filter((id) => present.has(id));
	const seen = new Set(kept);
	return [...kept, ...actual.filter((id) => !seen.has(id))];
};

const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));

export const placeAt = (
	order: readonly string[],
	id: string,
	index: number,
) => {
	const rest = order.filter((entry) => entry !== id);
	const at = clamp(index, 0, rest.length);
	return [...rest.slice(0, at), id, ...rest.slice(at)];
};

export const slotAt = (
	offset: number,
	firstTop: number,
	step: number,
	count: number,
) => {
	if (count <= 0 || step <= 0) return 0;
	return clamp(Math.round((offset - firstTop) / step), 0, count - 1);
};

export const shiftOf = (
	target: readonly string[] | undefined,
	actual: readonly string[],
	id: string,
	step: number,
) => {
	if (!target) return 0;
	const to = target.indexOf(id);
	const from = actual.indexOf(id);
	if (to < 0 || from < 0) return 0;
	return (to - from) * step;
};

export const keyboardSlot = (key: string, index: number, count: number) => {
	if (count <= 0) return undefined;
	if (key === "ArrowUp") return Math.max(0, index - 1);
	if (key === "ArrowDown") return Math.min(count - 1, index + 1);
	if (key === "Home") return 0;
	if (key === "End") return count - 1;
	return undefined;
};

export const positionText = (index: number, count: number) =>
	`position ${index + 1} of ${count}`;
