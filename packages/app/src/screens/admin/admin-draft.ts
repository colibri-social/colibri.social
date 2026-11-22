import { createSignal, onCleanup } from "solid-js";

const [drafts, setDrafts] = createSignal<ReadonlyMap<string, unknown>>(
	new Map(),
);

export const adminDraftKey = (scope: string, space: string, id: string) =>
	`${scope}:${space}:${id}`;

export const provideAdminDraft = <T>(key: string, draft: T) => {
	setDrafts((current) => new Map(current).set(key, draft));
	onCleanup(() =>
		setDrafts((current) => {
			if (current.get(key) !== draft) return current;
			const next = new Map(current);
			next.delete(key);
			return next;
		}),
	);
};

export const adminDraft = <T>(key: string) =>
	drafts().get(key) as T | undefined;
