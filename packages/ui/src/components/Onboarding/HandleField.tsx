import { Search } from "@kobalte/core/search";
import { createSignal, type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { revealLayer, topLayerAttrs } from "../../utils/nested-layers";
import { usePopperOverflowPadding } from "../../utils/safe-area";
import { createSlot } from "../../utils/slot";
import { Avatar } from "../Avatar/Avatar";
import { menuContentClass } from "../ContextMenu/Menu";

export type HandleSuggestion = {
	did: string;
	handle: string;
	displayName?: string;
	avatar?: string;
};

export const HANDLE_QUERY_DEBOUNCE_MS = 250;

export const normalizeHandleQuery = (value: string) =>
	value.trim().replace(/^@/, "");

const fieldShell = cx(
	"flex h-10 w-full items-center gap-2 rounded-control border border-border bg-secondary px-3",
	"transition-[border-color,box-shadow] duration-[calc(var(--duration-color)*var(--motion-scale))]",
	"has-[:focus-visible]:border-primary",
	"has-[:focus-visible]:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_25%,transparent)]",
	"group-data-invalid/root:border-destructive",
	"group-data-invalid/root:has-[:focus-visible]:shadow-[0_0_0_3px_color-mix(in_srgb,var(--destructive)_25%,transparent)]",
);

export type HandleFieldProps = {
	label: string;
	placeholder?: string;
	error?: JSX.Element;
	suggestions?: readonly HandleSuggestion[];
	onInput: (value: string) => void;
	onQuery?: (query: string) => void;
	onAccept: (suggestion: HandleSuggestion) => void;
	class?: string;
};

export const HandleField = (props: HandleFieldProps) => {
	const overflowPadding = usePopperOverflowPadding();
	const error = createSlot(() => props.error);
	const [raw, setRaw] = createSignal("");
	const [open, setOpen] = createSignal(false);
	const [selected, setSelected] = createSignal<HandleSuggestion | null>(null);
	const suggestions = () => [...(props.suggestions ?? [])];
	const hasQuery = () =>
		props.onQuery !== undefined && normalizeHandleQuery(raw()).length > 0;

	const accept = (suggestion: HandleSuggestion) => {
		setSelected(suggestion);
		setRaw(suggestion.handle);
		props.onInput(suggestion.handle);
		props.onAccept(suggestion);
	};

	const activeSuggestion = (input: HTMLInputElement) => {
		const id = input.getAttribute("aria-activedescendant");
		if (!id) return undefined;
		const did = document
			.getElementById(id)
			?.getAttribute("data-handle-suggestion");
		return suggestions().find((suggestion) => suggestion.did === did);
	};

	const onKeyDown = (
		event: KeyboardEvent & { currentTarget: HTMLInputElement },
	) => {
		if (event.key !== "Enter" && event.key !== "Tab") return;
		if (event.key === "Tab" && event.shiftKey) return;
		const active = open() ? activeSuggestion(event.currentTarget) : undefined;
		if (event.key === "Tab") {
			if (!active) return;
			event.preventDefault();
			accept(active);
			return;
		}
		if (active) return;
		event.preventDefault();
		event.currentTarget.form?.requestSubmit();
	};

	return (
		<Search<HandleSuggestion>
			options={suggestions()}
			value={selected()}
			onChange={(picked) => {
				if (picked) accept(picked);
			}}
			onInputChange={(value) => props.onQuery?.(normalizeHandleQuery(value))}
			debounceOptionsMillisecond={HANDLE_QUERY_DEBOUNCE_MS}
			triggerMode="input"
			optionValue="did"
			optionLabel="handle"
			optionTextValue="handle"
			open={open() && hasQuery()}
			onOpenChange={setOpen}
			placeholder={props.placeholder}
			validationState={error.has() ? "invalid" : "valid"}
			sameWidth
			gutter={6}
			placement="bottom-start"
			overflowPadding={overflowPadding()}
			class={cx("group/root flex w-full flex-col gap-2", props.class)}
			itemComponent={(itemProps) => (
				<Search.Item
					item={itemProps.item}
					data-handle-suggestion={itemProps.item.rawValue.did}
					class={cx(
						"flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-control-sm px-2 py-1.5 text-left outline-none select-none",
						"data-highlighted:bg-popover-highlight",
					)}
				>
					<Avatar
						size="base"
						name={
							itemProps.item.rawValue.displayName ??
							itemProps.item.rawValue.handle
						}
						seed={itemProps.item.rawValue.did}
						src={itemProps.item.rawValue.avatar}
					/>
					<span class="flex min-w-0 flex-1 flex-col">
						<Search.ItemLabel class="truncate text-sm font-semibold text-foreground">
							{itemProps.item.rawValue.displayName ??
								itemProps.item.rawValue.handle}
						</Search.ItemLabel>
						<Search.ItemDescription class="truncate text-xs leading-4 text-muted-foreground">
							@{itemProps.item.rawValue.handle}
						</Search.ItemDescription>
					</span>
				</Search.Item>
			)}
		>
			<Search.Label class="text-sm font-medium text-muted-foreground">
				{props.label}
			</Search.Label>
			<Search.Control class={fieldShell}>
				<span
					aria-hidden="true"
					class="flex min-w-4 shrink-0 items-center justify-center text-foreground"
				>
					@
				</span>
				<Search.Input
					autocapitalize="none"
					autocorrect="off"
					autocomplete="username"
					spellcheck={false}
					inputMode="url"
					onInput={(event) => {
						const value = event.currentTarget.value;
						setRaw(value);
						if (selected() && value !== selected()?.handle) setSelected(null);
						props.onInput(value);
					}}
					onKeyDown={onKeyDown}
					class="h-full min-w-0 flex-1 bg-transparent font-sans text-base font-semibold text-foreground outline-none placeholder:text-muted-foreground"
				/>
			</Search.Control>
			<Show when={error.has()}>
				<Search.Description class="text-xs font-medium text-destructive">
					{error()}
				</Search.Description>
			</Show>
			<Search.Portal>
				<Search.Content
					{...topLayerAttrs}
					ref={revealLayer}
					data-handle-suggestions=""
					class={cx(
						menuContentClass,
						"max-w-none min-w-0 origin-(--kb-combobox-content-transform-origin)",
					)}
				>
					<Search.Listbox class="m-0 flex max-h-[min(320px,var(--kb-popper-content-available-height))] flex-col overflow-y-auto p-0 outline-none" />
					<Search.NoResult class="m-0 px-2 py-3 text-center text-sm text-muted-foreground">
						No accounts found.
					</Search.NoResult>
				</Search.Content>
			</Search.Portal>
		</Search>
	);
};
