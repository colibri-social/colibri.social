import { batch, untrack } from "solid-js";
import { createStore, produce, reconcile } from "solid-js/store";

export type RecordStore<V> = {
	state: Readonly<Record<string, V | undefined>>;
	get: (key: string) => V | undefined;
	put: (key: string, value: V) => void;
	putAll: (entries: Iterable<readonly [string, V]>) => void;
	update: (
		key: string,
		change: (current: V | undefined) => V | undefined,
	) => void;
	remove: (key: string) => void;
	clear: () => void;
};

export const createRecordStore = <V>(
	initial: Record<string, V> = {},
): RecordStore<V> => {
	const [state, setState] = createStore<Record<string, V | undefined>>(initial);
	const put = (key: string, value: V) => setState(key, reconcile(value));
	const remove = (key: string) => {
		if (!untrack(() => key in state)) return;
		setState(
			produce((draft) => {
				delete draft[key];
			}),
		);
	};
	return {
		state,
		get: (key) => state[key],
		put,
		putAll: (entries) =>
			batch(() => {
				for (const [key, value] of entries) put(key, value);
			}),
		update: (key, change) => {
			const next = change(untrack(() => state[key]));
			if (next === undefined) remove(key);
			else put(key, next);
		},
		remove,
		clear: () => setState(reconcile({})),
	};
};
