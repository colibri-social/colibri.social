export type VirtualMeasure = {
	findItemIndex(offset: number): number;
	getItemOffset(index: number): number;
};

export type VirtualAnchorCandidate = { key: string; top: number };

export type VirtualAnchor = { candidates: VirtualAnchorCandidate[] };

export const ANCHOR_CANDIDATE_LIMIT = 6;

export const captureVirtualAnchor = (
	measure: VirtualMeasure,
	keys: readonly string[],
	scrollTop: number,
	startMargin: number,
	limit = ANCHOR_CANDIDATE_LIMIT,
): VirtualAnchor | undefined => {
	if (keys.length === 0) return undefined;
	const first = Math.max(
		0,
		Math.min(keys.length - 1, measure.findItemIndex(scrollTop)),
	);
	const candidates: VirtualAnchorCandidate[] = [];
	for (
		let index = first;
		index < keys.length && candidates.length < limit;
		index++
	) {
		candidates.push({
			key: keys[index] as string,
			top: startMargin + measure.getItemOffset(index) - scrollTop,
		});
	}
	return candidates.length > 0 ? { candidates } : undefined;
};

export const resolveVirtualAnchor = (
	anchor: VirtualAnchor,
	indexOf: (key: string) => number | undefined,
	measure: VirtualMeasure,
	startMargin: number,
): number | undefined => {
	for (const candidate of anchor.candidates) {
		const index = indexOf(candidate.key);
		if (index === undefined) continue;
		return startMargin + measure.getItemOffset(index) - candidate.top;
	}
	return undefined;
};

export const findScrollParent = (element: Element): HTMLElement | undefined => {
	let node = element.parentElement;
	while (node && node !== document.body && node !== document.documentElement) {
		const overflow = getComputedStyle(node).overflowY;
		if (overflow === "auto" || overflow === "scroll" || overflow === "overlay")
			return node;
		node = node.parentElement;
	}
	return undefined;
};
