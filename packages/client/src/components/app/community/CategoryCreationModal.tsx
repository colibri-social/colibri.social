import { createSignal, type ParentComponent } from "solid-js";
import { toast } from "somoto";
import { useUserContext } from "../../../contexts/User";
import { Button } from "../../ui/Button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogPortal,
	DialogTitle,
	DialogTrigger,
} from "../../ui/Dialog";
import {
	TextField,
	TextFieldInput,
	TextFieldLabel,
} from "../../ui/TextField";

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
			await user.xrpc.social.colibri.community.createCategory(props.community, name().trim());
			setOpen(false);
			setName("");
		} catch {
			toast.error("Failed to create category.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<Dialog open={open()} onOpenChange={setOpen}>
			<DialogTrigger>{props.children}</DialogTrigger>
			<DialogPortal>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create Category</DialogTitle>
					</DialogHeader>
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
				</DialogContent>
			</DialogPortal>
		</Dialog>
	);
};
