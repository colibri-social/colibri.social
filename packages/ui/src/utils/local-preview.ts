import {
	type Accessor,
	createEffect,
	createMemo,
	createSignal,
	on,
	onCleanup,
} from "solid-js";

const ANIMATED_TYPES = new Set(["image/gif", "image/webp", "image/apng"]);

export type LocalPreview = {
	src: Accessor<string | undefined>;
	animated: Accessor<boolean | undefined>;
	set: (file: File) => void;
	clear: () => void;
};

export const createLocalPreview = (
	controlled: Accessor<string | undefined>,
): LocalPreview => {
	const [local, setLocal] = createSignal<{ url: string; animated: boolean }>();

	const revoke = () => {
		const current = local();
		if (current) URL.revokeObjectURL(current.url);
	};

	const clear = () => {
		revoke();
		setLocal(undefined);
	};

	const source = createMemo(controlled);
	createEffect(on(source, clear, { defer: true }));
	onCleanup(revoke);

	return {
		src: () => local()?.url ?? source(),
		animated: () => (local() ? local()?.animated : undefined),
		set: (file) => {
			revoke();
			setLocal({
				url: URL.createObjectURL(file),
				animated: ANIMATED_TYPES.has(file.type),
			});
		},
		clear,
	};
};
