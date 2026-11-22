import { type Accessor, createMemo, For, type JSX } from "solid-js";

const sameKeys = (a: readonly string[], b: readonly string[]) =>
	a.length === b.length && a.every((key, index) => key === b[index]);

export type KeyedForProps<T> = {
	each: readonly T[] | undefined;
	by: (item: T) => string;
	children: (item: Accessor<T>, index: Accessor<number>) => JSX.Element;
};

export const KeyedFor = <T,>(props: KeyedForProps<T>) => {
	const byKey = createMemo(() => {
		const map = new Map<string, T>();
		for (const item of props.each ?? []) map.set(props.by(item), item);
		return map;
	});
	const keys = createMemo(() => [...byKey().keys()], [], { equals: sameKeys });
	return (
		<For each={keys()}>
			{(key, index) => {
				const item = createMemo<T>(
					(previous) => byKey().get(key) ?? previous,
					byKey().get(key) as T,
				);
				return props.children(item, index);
			}}
		</For>
	);
};
