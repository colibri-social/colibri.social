import { TextField as KobalteTextField } from "@kobalte/core/text-field";
import { CloseCircleIcon } from "@solar-icons/solid/bold/close-circle";
import { MagnifierIcon } from "@solar-icons/solid/bold/magnifier";
import { createSignal, type JSX, Show, splitProps } from "solid-js";
import { cx } from "../../utils/cx";
import { createSlot } from "../../utils/slot";

const fieldShell = [
	"group/field flex w-full items-center gap-2 rounded-control border border-border bg-secondary px-3",
	"transition-[border-color,box-shadow,background-color] duration-[calc(var(--duration-color)*var(--motion-scale))]",
	"has-[:focus-visible]:border-primary",
	"has-[:focus-visible]:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_25%,transparent)]",
	"group-data-invalid/root:border-destructive",
	"group-data-invalid/root:has-[:focus-visible]:shadow-[0_0_0_3px_color-mix(in_srgb,var(--destructive)_25%,transparent)]",
	"group-data-disabled/root:opacity-50 group-data-disabled/root:cursor-not-allowed",
];

const inputText = [
	"min-w-0 flex-1 bg-transparent font-sans text-base font-semibold text-foreground outline-none",
	"placeholder:text-muted-foreground disabled:cursor-not-allowed",
];

type FieldBaseProps = {
	label?: JSX.Element;
	description?: JSX.Element;
	error?: JSX.Element;
	value?: string;
	defaultValue?: string;
	onChange?: (value: string) => void;
	placeholder?: string;
	disabled?: boolean;
	readOnly?: boolean;
	required?: boolean;
	name?: string;
	id?: string;
	class?: string;
	"aria-label"?: string;
};

const FieldFrame = (props: {
	label?: JSX.Element;
	description?: JSX.Element;
	error?: JSX.Element;
	trailingAction?: JSX.Element;
	children: JSX.Element;
}) => {
	const label = createSlot(() => props.label);
	const description = createSlot(() => props.description);
	const error = createSlot(() => props.error);
	const trailingAction = createSlot(() => props.trailingAction);

	return (
		<>
			<Show when={label.has()}>
				<KobalteTextField.Label class="text-sm font-medium text-muted-foreground">
					{label()}
				</KobalteTextField.Label>
			</Show>
			<div class="flex w-full items-center gap-2">
				{props.children}
				<Show when={trailingAction.has()}>
					<div class="flex shrink-0 items-center">{trailingAction()}</div>
				</Show>
			</div>
			<Show when={description.has() && !error.has()}>
				<KobalteTextField.Description class="text-xs text-muted-foreground">
					{description()}
				</KobalteTextField.Description>
			</Show>
			<KobalteTextField.ErrorMessage class="text-xs font-medium text-destructive">
				{error()}
			</KobalteTextField.ErrorMessage>
		</>
	);
};

export type TextFieldProps = FieldBaseProps & {
	type?: "text" | "email" | "url" | "password" | "search";
	leading?: JSX.Element;
	trailing?: JSX.Element;
	trailingAction?: JSX.Element;
	inputMode?: JSX.HTMLAttributes<HTMLInputElement>["inputMode"];
	autocomplete?: string;
	maxLength?: number;
	ref?: (element: HTMLInputElement) => void;
	onKeyDown?: JSX.EventHandler<HTMLInputElement, KeyboardEvent>;
};

export const TextField = (props: TextFieldProps) => {
	const [local, input, rest] = splitProps(
		props,
		[
			"label",
			"description",
			"error",
			"leading",
			"trailing",
			"trailingAction",
			"class",
		],
		[
			"type",
			"placeholder",
			"inputMode",
			"autocomplete",
			"maxLength",
			"ref",
			"onKeyDown",
			"aria-label",
		],
	);
	const error = createSlot(() => local.error);
	const leading = createSlot(() => local.leading);
	const trailing = createSlot(() => local.trailing);

	return (
		<KobalteTextField
			{...rest}
			validationState={error.has() ? "invalid" : "valid"}
			class={cx("group/root flex w-full flex-col gap-2", local.class)}
		>
			<FieldFrame
				label={local.label}
				description={local.description}
				error={error()}
				trailingAction={local.trailingAction}
			>
				<div class={cx(fieldShell, "h-10")}>
					<Show when={leading.has()}>
						<span class="flex min-w-4 shrink-0 items-center justify-center text-muted-foreground [&>svg]:size-4">
							{leading()}
						</span>
					</Show>
					<KobalteTextField.Input {...input} class={cx(inputText, "h-full")} />
					<Show when={trailing.has()}>
						<span class="flex shrink-0 items-center text-muted-foreground">
							{trailing()}
						</span>
					</Show>
				</div>
			</FieldFrame>
		</KobalteTextField>
	);
};

export type TextAreaProps = FieldBaseProps & {
	rows?: number;
	autoResize?: boolean;
	maxLength?: number;
	showCount?: boolean;
	trailingAction?: JSX.Element;
};

export const TextArea = (props: TextAreaProps) => {
	const [local, rest] = splitProps(props, [
		"label",
		"description",
		"error",
		"class",
		"rows",
		"autoResize",
		"maxLength",
		"showCount",
		"placeholder",
		"trailingAction",
		"value",
		"defaultValue",
		"onChange",
		"aria-label",
	]);
	const [internal, setInternal] = createSignal(local.defaultValue ?? "");
	const value = () => local.value ?? internal();
	const onChange = (next: string) => {
		setInternal(next);
		local.onChange?.(next);
	};
	const error = createSlot(() => local.error);
	const remaining = () =>
		local.maxLength === undefined
			? undefined
			: local.maxLength - value().length;

	return (
		<KobalteTextField
			{...rest}
			value={value()}
			onChange={onChange}
			validationState={error.has() ? "invalid" : "valid"}
			class={cx("group/root flex w-full flex-col gap-2", local.class)}
		>
			<FieldFrame
				label={local.label}
				description={local.description}
				error={error()}
				trailingAction={local.trailingAction}
			>
				<div
					class={cx(fieldShell, "relative items-start rounded-control-lg p-3")}
				>
					<KobalteTextField.TextArea
						rows={local.rows ?? 4}
						autoResize={local.autoResize}
						maxLength={local.maxLength}
						placeholder={local.placeholder}
						aria-label={local["aria-label"]}
						class={cx(
							inputText,
							"min-h-[94px] resize-none leading-snug",
							local.showCount && "pb-4",
						)}
					/>
					<Show when={local.showCount && remaining() !== undefined}>
						<span
							class="pointer-events-none absolute right-3 bottom-2 text-xs tabular-nums text-muted-foreground"
							classList={{ "text-destructive": (remaining() ?? 1) <= 0 }}
							aria-live="polite"
						>
							{remaining()}
						</span>
					</Show>
				</div>
			</FieldFrame>
		</KobalteTextField>
	);
};

export type SearchFieldProps = Omit<
	TextFieldProps,
	"type" | "leading" | "trailing" | "label"
> & {
	label?: JSX.Element;
	clearLabel?: string;
};

export const SearchField = (props: SearchFieldProps) => {
	const [local, rest] = splitProps(props, [
		"value",
		"defaultValue",
		"onChange",
		"clearLabel",
	]);
	const [internal, setInternal] = createSignal(local.defaultValue ?? "");
	const value = () => local.value ?? internal();
	let input: HTMLInputElement | undefined;

	const onChange = (next: string) => {
		setInternal(next);
		local.onChange?.(next);
	};

	const clear = () => {
		onChange("");
		input?.focus();
	};

	return (
		<TextField
			{...rest}
			type="search"
			value={value()}
			onChange={onChange}
			ref={(element) => {
				input = element;
				rest.ref?.(element);
			}}
			onKeyDown={(event) => {
				rest.onKeyDown?.(event);
				if (event.key === "Escape" && value()) {
					event.preventDefault();
					clear();
				}
			}}
			leading={<MagnifierIcon />}
			trailing={
				<button
					type="button"
					tabIndex={-1}
					aria-label={local.clearLabel ?? "Clear search"}
					onClick={clear}
					class={cx(
						"flex size-5 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:text-foreground",
						"transition-[opacity,transform] duration-[calc(var(--duration-color)*var(--motion-scale))] ease-[var(--ease-out-quick)]",
						value()
							? "scale-100 opacity-100"
							: "pointer-events-none scale-75 opacity-0",
					)}
				>
					<CloseCircleIcon size={18} />
				</button>
			}
			class={cx(
				"[&_input::-webkit-search-cancel-button]:appearance-none",
				rest.class,
			)}
		/>
	);
};
