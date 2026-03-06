import { actions } from "astro:actions";
import { createSignal, type ParentComponent } from "solid-js";
import { toast } from "somoto";
import { parseZodToErrorOrDisplay } from "@/utils/parse-zod-to-error-or-display";
import { useGlobalContext } from "../../contexts/GlobalContext/index";
import { Spinner } from "../../icons/Spinner";
import { Button } from "../../shadcn-solid/Button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogPortal,
	DialogTrigger,
} from "../../shadcn-solid/Dialog";
import {
	TextField,
	TextFieldDescription,
	TextFieldInput,
	TextFieldLabel,
} from "../../shadcn-solid/text-field";

/**
 * A modal for creating a category.
 */
export const CategoryCreationModal: ParentComponent<{ community: string }> = (
	props,
) => {
	const [, { addCategory }] = useGlobalContext();
	const [name, setName] = createSignal("");
	const [loading, setLoading] = createSignal(false);
	const [open, setOpen] = createSignal(false);

	/**
	 * Creates a new category in the specified community and immediately
	 * adds it to the global context for optimistic display.
	 */
	const createCategory = async () => {
		setLoading(true);

		const result = await actions.createCategory({
			community: props.community,
			name: name(),
		});

		setLoading(false);

		if (result.error) {
			toast.error("Failed to create category", {
				description: parseZodToErrorOrDisplay(result.error.message),
			});
			return;
		}

		if (result.data) {
			setName("");
			addCategory(result.data);
			setOpen(false);
		}
	};

	return (
		<Dialog open={open()} onOpenChange={setOpen}>
			<DialogTrigger>{props.children}</DialogTrigger>
			<DialogPortal>
				<DialogContent class="w-92">
					<DialogHeader>
						<h2 class="m-0 text-center">Create a category</h2>
					</DialogHeader>
					<div>
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
								Category Name <span class="text-destructive">*</span>
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
					</div>
					<DialogFooter>
						<Button
							variant="secondary"
							disabled={loading()}
							onClick={() => setOpen(false)}
						>
							Cancel
						</Button>
						<Button disabled={loading()} onClick={createCategory}>
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
