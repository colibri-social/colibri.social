import { actions } from "astro:actions";
import { createSignal, type ParentComponent, Show } from "solid-js";
import { toast } from "somoto";
import { parseZodToErrorOrDisplay } from "@/utils/parse-zod-to-error-or-display";
import type { ChannelType } from "@/utils/sdk";
import { useGlobalContext } from "../../contexts/GlobalContext/index";
import { Spinner } from "../../icons/Spinner";
import { Button } from "../../shadcn-solid/Button";
import {
	Checkbox,
	CheckboxControl,
	CheckboxDescription,
	CheckboxInput,
	CheckboxLabel,
} from "../../shadcn-solid/Checkbox";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogPortal,
	DialogTrigger,
} from "../../shadcn-solid/Dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "../../shadcn-solid/Select";
import {
	TextField,
	TextFieldDescription,
	TextFieldInput,
	TextFieldLabel,
} from "../../shadcn-solid/text-field";
import { ImageForChannelType } from "../common/IconForChannelType";

/**
 * The creation modal for a new channel within a category.
 */
export const ChannelCreationModal: ParentComponent<{
	category: string;
	community: string;
}> = (props) => {
	const [, { addChannel }] = useGlobalContext();
	const [name, setName] = createSignal("");
	const [channelType, setChannelType] = createSignal<string>("Text");
	const [loading, setLoading] = createSignal(false);
	const [open, setOpen] = createSignal(false);
	const [isOwnerOnly, setIsOwnerOnly] = createSignal(false);

	/**
	 * Creates a new channel within the specified category and immediately
	 * adds it to the global context for optimistic display.
	 */
	const createChannel = async () => {
		setLoading(true);

		const result = await actions.createChannel({
			category: props.category,
			community: props.community,
			name: name(),
			type: channelType().toLowerCase() as ChannelType,
			ownerOnly: channelType().toLowerCase() === "text" ? isOwnerOnly() : false,
		});

		setLoading(false);

		if (result.error) {
			toast.error("Failed to create channel", {
				description: parseZodToErrorOrDisplay(result.error.message),
			});
			return;
		}
		if (result.data) {
			addChannel(result.data);
			setOpen(false);
		}
	};

	return (
		<Dialog open={open()} onOpenChange={setOpen}>
			<DialogTrigger>{props.children}</DialogTrigger>
			<DialogPortal>
				<DialogContent class="w-92">
					<DialogHeader>
						<h2 class="m-0 text-center">Create a channel</h2>
					</DialogHeader>
					<div class="flex flex-col gap-4">
						<TextField
							value={name()}
							onChange={setName}
							validationState={
								name() !== undefined &&
								name()!.trim().length < 33 &&
								name()!.trim().length > 0
									? "valid"
									: "invalid"
							}
						>
							<TextFieldLabel>
								Channel Name <span class="text-destructive">*</span>
							</TextFieldLabel>
							<TextFieldInput
								maxLength={32}
								minLength={1}
								type="text"
								required
							/>
							<TextFieldDescription>
								Must be between one and 32 characters long.
							</TextFieldDescription>
						</TextField>
						<Select
							options={["Text", "Voice", "Forum"]}
							placeholder="Channel type"
							disallowEmptySelection
							value={channelType()}
							onChange={setChannelType}
							itemComponent={(props) => (
								<SelectItem
									item={props.item}
									class="[&>div]:flex [&>div]:gap-2 [&>div]:items-center"
								>
									<ImageForChannelType
										channelType={props.item.rawValue.toLowerCase()}
									/>
									{props.item.rawValue}
								</SelectItem>
							)}
						>
							<SelectLabel>Channel type</SelectLabel>
							<SelectTrigger class="w-full" aria-label="Channel type">
								<SelectValue<string>>
									{(state) => (
										<>
											<ImageForChannelType
												channelType={state.selectedOption().toLowerCase()}
											/>
											{state.selectedOption()}
										</>
									)}
								</SelectValue>
							</SelectTrigger>
							<SelectContent class="[&>ul]:m-0 [&>ul]:py-0 [&>ul]:px-2" />
						</Select>
						<Show when={channelType() === "Text"}>
							<Checkbox
								checked={isOwnerOnly()}
								onChange={setIsOwnerOnly}
								class="flex justify-between items-center gap-x-2 w-full"
							>
								<div class="flex flex-col gap-1">
									<CheckboxLabel>Owner only?</CheckboxLabel>
									<CheckboxDescription>
										Whether you will be the only one able to post in this
										channel.
									</CheckboxDescription>
								</div>
								<CheckboxInput />
								<CheckboxControl />
							</Checkbox>
						</Show>
					</div>
					<DialogFooter>
						<Button
							variant="secondary"
							disabled={loading()}
							onClick={() => setOpen(false)}
						>
							Cancel
						</Button>
						<Button disabled={loading()} onClick={createChannel}>
							<Spinner
								classList={{
									hidden: !loading(),
									block: loading(),
								}}
							/>
							Create
						</Button>
					</DialogFooter>
				</DialogContent>
			</DialogPortal>
		</Dialog>
	);
};
