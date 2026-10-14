import {
	type Accessor,
	createContext,
	createSignal,
	onCleanup,
	useContext,
} from "solid-js";

export type DirtySource = {
	dirty: () => boolean;
	onDiscard?: () => void;
	description?: () => string | undefined;
};

type PendingLeave<S> = { leave: () => void; affected: S[] };

export type DirtyGuard<S extends DirtySource = DirtySource> = {
	register: (source: S) => () => void;
	isDirty: (applies?: (source: S) => boolean) => boolean;
	hold: (leave: () => void, applies?: (source: S) => boolean) => boolean;
	attempt: (leave: () => void, applies?: (source: S) => boolean) => void;
	prompting: Accessor<boolean>;
	description: Accessor<string | undefined>;
	discard: () => void;
	keep: () => void;
};

export const createDirtyGuard = <
	S extends DirtySource = DirtySource,
>(): DirtyGuard<S> => {
	const everySource = (_source: S) => true;
	const sources = new Set<S>();
	const [pending, setPending] = createSignal<PendingLeave<S>>();

	const affected = (applies: (source: S) => boolean) =>
		[...sources].filter((source) => applies(source) && source.dirty());

	const hold = (leave: () => void, applies = everySource) => {
		if (pending()) return true;
		const dirty = affected(applies);
		if (dirty.length === 0) return false;
		setPending({ leave, affected: dirty });
		return true;
	};

	return {
		register: (source) => {
			sources.add(source);
			return () => {
				sources.delete(source);
			};
		},
		isDirty: (applies = everySource) => affected(applies).length > 0,
		hold,
		attempt: (leave, applies) => {
			if (!hold(leave, applies)) leave();
		},
		prompting: () => !!pending(),
		description: () => {
			const current = pending();
			if (current?.affected.length !== 1) return undefined;
			return current.affected[0]?.description?.();
		},
		discard: () => {
			const current = pending();
			setPending(undefined);
			if (!current) return;
			for (const source of current.affected) source.onDiscard?.();
			current.leave();
		},
		keep: () => setPending(undefined),
	};
};

export const DirtyGuardContext = createContext<DirtyGuard>();

export const useDirtyGuard = () => useContext(DirtyGuardContext);

export const useDirtyState = (
	dirty: () => boolean,
	options: Omit<DirtySource, "dirty"> = {},
) => {
	const guard = useDirtyGuard();
	if (!guard) return;
	onCleanup(guard.register({ ...options, dirty }));
};
