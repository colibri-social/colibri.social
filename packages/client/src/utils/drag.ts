export const capturePositions = (
	els: Map<string, HTMLElement>,
	tops: Map<string, number>,
) => {
	for (const [rkey, el] of els) {
		tops.set(rkey, el.getBoundingClientRect().top);
	}
};

export const animateToNewPositions = (
	els: Map<string, HTMLElement>,
	tops: Map<string, number>,
) => {
	for (const [rkey, el] of els) {
		const oldTop = tops.get(rkey);
		if (oldTop === undefined) continue;
		const newTop = el.getBoundingClientRect().top;
		const delta = oldTop - newTop;
		if (delta === 0) continue;
		el.animate(
			[
				{ transform: `translateY(${delta}px)` },
				{ transform: "translateY(0px)" },
			],
			{ duration: 150, easing: "ease" },
		);
	}
};

export const reorderList = <T>(
	list: T[],
	fromIndex: number,
	toIndex: number,
): T[] => {
	if (fromIndex === toIndex || fromIndex === -1 || toIndex === -1) return list;
	const result = list.slice();
	result.splice(toIndex, 0, ...result.splice(fromIndex, 1));
	return result;
};
