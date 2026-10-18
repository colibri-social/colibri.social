const scrolls = (element: Element) => {
	const style = getComputedStyle(element);
	const scrollable = (overflow: string) =>
		overflow === "auto" || overflow === "scroll" || overflow === "overlay";
	return (
		(scrollable(style.overflowY) &&
			element.scrollHeight > element.clientHeight) ||
		(scrollable(style.overflowX) && element.scrollWidth > element.clientWidth)
	);
};

export const stopScrollMotion = (from: Element | null) => {
	for (let element = from; element; element = element.parentElement) {
		if (!scrolls(element)) continue;
		element.scrollTo({
			top: element.scrollTop,
			left: element.scrollLeft,
			behavior: "instant",
		});
	}
};
