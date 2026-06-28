import { createSignal, type ParentComponent } from "solid-js";
import { toast } from "somoto";
import { useUserContext } from "../../../contexts/User";
import { Button } from "../../ui/Button";
import { DialogFooter } from "../../ui/Dialog";
import { ResponsiveDialog } from "../../ui/ResponsiveDialog";
import { TextField, TextFieldInput, TextFieldLabel } from "../../ui/TextField";

export const CategoryCreationModal: ParentComponent<{
	/** AT-URI of the community this category will belong to. */
	community: string;
}> = (props) => {
	const user = useUserContext();
	const [open, setOpen] = createSignal(false);
	const [name, setName] = createSignal("");
	const [loading, setLoading] = createSignal(false);

	const handleCreate = async () => {
		setLoading(true);
		try {
			await user.xrpc.social.colibri.category.create(
				props.community,
				name().trim(),
			);
			setOpen(false);
			setName("");
		} catch {
			toast.error("Failed to create category.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<ResponsiveDialog
			open={open()}
			onOpenChange={setOpen}
			trigger={props.children}
			title="Create Category"
		>
			<TextField class="gap-1.5">
				<TextFieldLabel>Name</TextFieldLabel>
				<TextFieldInput
					placeholder="New category"
					value={name()}
					onInput={(e) => setName(e.currentTarget.value)}
				/>
			</TextField>
			<DialogFooter>
				<Button variant="secondary" onClick={() => setOpen(false)}>
					Cancel
				</Button>
				<Button
					onClick={handleCreate}
					disabled={loading() || name().trim().length === 0}
				>
					Create
				</Button>
			</DialogFooter>
		</ResponsiveDialog>
	);
};
