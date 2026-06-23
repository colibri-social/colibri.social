import { createSignal, Show, type ParentComponent } from "solid-js";
import { toast } from "somoto";
import type { Category } from "../../../atproto/xrpc/social/colibri/community/listCategories";
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
import { TextField, TextFieldInput, TextFieldLabel } from "../../ui/TextField";
import { usePermissions } from "../../../contexts/Community";

export const CategorySettingsModal: ParentComponent<{
	category: Category;
}> = (props) => {
	const user = useUserContext();
	const { canDeleteCategory: _canDeleteCategory } = usePermissions();
	const [open, setOpen] = createSignal(false);
	const [name, setName] = createSignal(props.category.name);
	const [loading, setLoading] = createSignal(false);

	const canDeleteCategory = () => _canDeleteCategory(user.did);

	const handleSave = async () => {
		setLoading(true);
		try {
			await user.xrpc.social.colibri.category.update(
				props.category.uri,
				name().trim(),
			);
			setOpen(false);
		} catch {
			toast.error("Failed to save category.");
		} finally {
			setLoading(false);
		}
	};

	const handleDelete = async () => {
		setLoading(true);
		try {
			await user.xrpc.social.colibri.category.delete(props.category.uri);
			setOpen(false);
		} catch {
			toast.error("Failed to delete category.");
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
						<DialogTitle>Category Settings</DialogTitle>
					</DialogHeader>
					<TextField class="gap-1.5">
						<TextFieldLabel>Name</TextFieldLabel>
						<TextFieldInput
							value={name()}
							onInput={(e) => setName(e.currentTarget.value)}
						/>
					</TextField>
					<DialogFooter class="flex-col sm:flex-row gap-2">
						<Show when={canDeleteCategory()}>
							<Button
								variant="destructive"
								onClick={handleDelete}
								disabled={loading()}
								class="sm:mr-auto"
							>
								Delete Category
							</Button>
						</Show>
						<Button
							class="ml-auto"
							variant="secondary"
							onClick={() => setOpen(false)}
						>
							Cancel
						</Button>
						<Button
							onClick={handleSave}
							disabled={loading() || name().trim().length === 0}
						>
							Save
						</Button>
					</DialogFooter>
				</DialogContent>
			</DialogPortal>
		</Dialog>
	);
};
