import { actions } from "astro:actions";
import { createSignal, type ParentComponent } from "solid-js";
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
	const [name, setName] = createSignal("");
	const [loading, setLoading] = createSignal(false);

	/**
	 * Creates a new category in the specified community.
	 * @todo Add new category immediately, don't wait for websocket update
	 */
	const createCategory = async () => {
		setLoading(true);

		const _category = await actions.createCategory({
			community: props.community,
			name: name(),
		});

		setLoading(false);
	};

	return (
		<Dialog>
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
						<Button variant="secondary" disabled={loading()}>
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
