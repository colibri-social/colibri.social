import type { Navigator } from "../../shell/stack";

export const closePane = (stack: Navigator) => {
	const layers = stack.mounted().slice(0, stack.depth());
	const index = layers.findLastIndex(
		(layer) => layer.kind === "thread" || layer.kind === "threadDraft",
	);
	if (index === -1 || index === layers.length - 1) {
		stack.pop();
		return;
	}
	const kept = layers
		.slice(index + 1)
		.filter((layer) => layer.kind === "threads");
	stack.popTo(index);
	for (const layer of kept) stack.push(layer);
};
