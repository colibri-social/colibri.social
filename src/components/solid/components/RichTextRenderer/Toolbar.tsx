import {
	type Accessor,
	type Component,
	createSignal,
	type ParentComponent,
	Show,
} from "solid-js";
import { Bold } from "../../icons/Bold";
import { Code } from "../../icons/Code";
import { Italic } from "../../icons/Italic";
import { Link } from "../../icons/Link";
import { Strikethrough } from "../../icons/Strikethrough";
import { Underline } from "../../icons/Underline";
import { Button } from "../../shadcn-solid/Button";
import {
	Popover,
	PopoverContent,
	PopoverPortal,
	PopoverTrigger,
} from "../../shadcn-solid/Popover";
import {
	TextField,
	TextFieldErrorMessage,
	TextFieldInput,
	TextFieldLabel,
} from "../../shadcn-solid/text-field";
import { isValidUrl, type ToolbarState } from "./util";

/**
 * A button on the rich text editor toolbar.
 */
export const ToolbarButton: ParentComponent<{
	onClick?: (e: MouseEvent) => void;
	active?: boolean;
}> = (props) => (
	<button
		type="button"
		class="w-8 h-8 flex items-center justify-center cursor-pointer hover:bg-muted/50"
		classList={{ "bg-muted": !!props.active }}
		onMouseDown={(e) => e.preventDefault()}
		onClick={props.onClick}
	>
		{props.children}
	</button>
);

/**
 * The rich text editor toolbar.
 */
export const Toolbar: Component<{
	state: Accessor<ToolbarState | null>;
	onFormat: (type: string, link?: string) => void;
	onPopoverOpenChange?: (open: boolean) => void;
}> = (props) => {
	const [link, setLink] = createSignal("");
	const [linkError, setLinkError] = createSignal("");
	const [popoverOpen, setPopoverOpen] = createSignal(false);

	/**
	 * Opens or closes the link edit popover.
	 * @param open
	 */
	const handlePopoverOpenChange = (open: boolean) => {
		setPopoverOpen(open);
		if (!open) {
			setLink("");
			setLinkError("");
		}
		props.onPopoverOpenChange?.(open);
	};

	/**
	 * Handles validating a link and adding it.
	 * @returns
	 */
	const handleAddLink = () => {
		const url = link().trim();

		if (!url) {
			setLinkError("Please enter a URL.");
			return;
		}

		if (!isValidUrl(url)) {
			setLinkError("Please enter a valid http or https URL.");
			return;
		}

		setLinkError("");
		props.onFormat("link", url);
		setPopoverOpen(false);
		setLink("");
	};

	return (
		<Show when={props.state()}>
			{(state) => (
				<div
					class="absolute w-fit h-8 bg-card flex items-center border border-border rounded-sm overflow-hidden"
					style={{
						top: `${state().position.top - 48}px`,
						left: `${state().position.left}px`,
					}}
				>
					<ToolbarButton
						onClick={() => props.onFormat("bold")}
						active={state().activeFormats.has("bold")}
					>
						<Bold />
					</ToolbarButton>
					<ToolbarButton
						onClick={() => props.onFormat("italic")}
						active={state().activeFormats.has("italic")}
					>
						<Italic />
					</ToolbarButton>
					<ToolbarButton
						onClick={() => props.onFormat("underline")}
						active={state().activeFormats.has("underline")}
					>
						<Underline />
					</ToolbarButton>
					<ToolbarButton
						onClick={() => props.onFormat("strikethrough")}
						active={state().activeFormats.has("strikethrough")}
					>
						<Strikethrough />
					</ToolbarButton>
					<ToolbarButton
						onClick={() => props.onFormat("code")}
						active={state().activeFormats.has("code")}
					>
						<Code />
					</ToolbarButton>
					<Popover open={popoverOpen()} onOpenChange={handlePopoverOpenChange}>
						<PopoverTrigger>
							<ToolbarButton>
								<Link />
							</ToolbarButton>
						</PopoverTrigger>
						<PopoverPortal>
							<PopoverContent>
								<TextField validationState={linkError() ? "invalid" : "valid"}>
									<TextFieldLabel>Link</TextFieldLabel>
									<TextFieldInput
										type="url"
										value={link()}
										onInput={(e) => {
											setLink(e.currentTarget.value);
											if (linkError()) setLinkError("");
										}}
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												e.preventDefault();
												handleAddLink();
											}
										}}
										autocomplete="off"
										autocorrect="off"
										placeholder="https://colibri.social"
									/>
									<TextFieldErrorMessage>{linkError()}</TextFieldErrorMessage>
								</TextField>
								<div class="w-full flex justify-end">
									<Button
										class="mt-4 cursor-pointer ml-auto"
										onClick={handleAddLink}
									>
										Add
									</Button>
								</div>
							</PopoverContent>
						</PopoverPortal>
					</Popover>
				</div>
			)}
		</Show>
	);
};
