import { UnsavedChangesBar } from "@colibri-social/ui";
import { type Accessor, createEffect, createSignal, Show } from "solid-js";
import { usePlatform } from "../../screen/platform";
import { useUnsavedChanges } from "../../shell/unsaved-changes";

export const SETTINGS_CONTENT_CLASS =
	"mx-auto flex min-h-full w-full max-w-3xl flex-col gap-6";

export type UnsavedForm = {
	dirty: Accessor<boolean>;
	saving: Accessor<boolean>;
	attention: Accessor<number>;
	saveDisabled: Accessor<boolean>;
	save: () => void;
	cancel: () => void;
};

export type UnsavedFormOptions = {
	depth: () => number;
	dirty: () => boolean;
	saving: () => boolean;
	save: () => unknown;
	reset: () => void;
	saveDisabled?: () => boolean;
};

export const createUnsavedForm = (options: UnsavedFormOptions): UnsavedForm => {
	const [attention, setAttention] = createSignal(0);
	createEffect(() => {
		if (!options.dirty()) setAttention(0);
	});
	useUnsavedChanges({
		depth: options.depth,
		dirty: () => options.dirty() && !options.saving(),
		onBlocked: () => setAttention((count) => count + 1),
	});
	return {
		dirty: options.dirty,
		saving: options.saving,
		attention,
		saveDisabled: () => options.saveDisabled?.() ?? false,
		save: () => void options.save(),
		cancel: () => {
			if (options.saving()) return;
			options.reset();
		},
	};
};

export const UnsavedBar = (props: { form: UnsavedForm | undefined }) => (
	<Show when={props.form}>
		{(form) => (
			<UnsavedChangesBar
				platform={usePlatform()()}
				visible={form().dirty() || form().saving()}
				saving={form().saving()}
				saveDisabled={form().saveDisabled()}
				attention={form().attention()}
				onCancel={form().cancel}
				onSave={form().save}
			/>
		)}
	</Show>
);
