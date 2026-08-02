export type NavStack = { stack: Array<string>; index: number };

export const applyNavEntry = (
	stack: Array<string>,
	index: number,
	entry: string,
	pushed: boolean,
): NavStack => {
	if (index > 0 && stack[index - 1] === entry) {
		return { stack, index: index - 1 };
	}

	if (index < stack.length - 1 && stack[index + 1] === entry) {
		return { stack, index: index + 1 };
	}

	if (!pushed) {
		const replaced = stack.slice(0, index + 1);
		replaced[index] = entry;
		return { stack: replaced, index };
	}

	const next = stack.slice(0, index + 1);
	next.push(entry);
	return { stack: next, index: next.length - 1 };
};
