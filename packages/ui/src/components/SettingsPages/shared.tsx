import { createSignal, type JSX, onCleanup, Show } from "solid-js";
import { copyText } from "../../utils/clipboard";
import { cx } from "../../utils/cx";
import { createSlot } from "../../utils/slot";

export type SettingsPageProps = {
	intro?: JSX.Element;
	class?: string;
	children: JSX.Element;
};

export const SettingsPage = (props: SettingsPageProps) => {
	const intro = createSlot(() => props.intro);
	return (
		<div
			data-settings-page=""
			class={cx(
				"@container/settings flex w-full min-w-0 flex-col gap-6",
				props.class,
			)}
		>
			<Show when={intro.has()}>
				<p class="text-sm text-muted-foreground">{intro()}</p>
			</Show>
			{props.children}
		</div>
	);
};

export const SettingsEmpty = (props: { children: JSX.Element }) => (
	<p class="rounded-control bg-secondary px-3 py-6 text-center text-sm text-muted-foreground">
		{props.children}
	</p>
);

export const SettingsField = (props: {
	label?: JSX.Element;
	class?: string;
	children: JSX.Element;
}) => {
	const label = createSlot(() => props.label);
	return (
		<section class={cx("flex w-full min-w-0 flex-col gap-4", props.class)}>
			<Show when={label.has()}>
				<h3 class="text-sm font-medium text-muted-foreground">{label()}</h3>
			</Show>
			{props.children}
		</section>
	);
};

const COPIED_MS = 1500;

export const createCopied = () => {
	const [copied, setCopied] = createSignal(false);
	let timer: ReturnType<typeof setTimeout> | undefined;
	onCleanup(() => clearTimeout(timer));
	const copy = async (value: string, anchor: HTMLElement) => {
		if (!(await copyText(value, anchor))) return false;
		clearTimeout(timer);
		setCopied(true);
		timer = setTimeout(() => setCopied(false), COPIED_MS);
		return true;
	};
	return { copied, copy };
};
