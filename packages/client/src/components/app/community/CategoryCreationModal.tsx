import { createSignal, type ParentComponent } from "solid-js";
import { colibri } from "../../../atproto/lexicons";
import { clientForManagingApp } from "../../../atproto/xrpc";
import { useCommunityContext } from "../../../contexts/Community";
import { useUserContext } from "../../../contexts/User";
import { showError } from "../../../errors/show-error";
import { Button } from "../../ui/Button";
import { DialogFooter } from "../../ui/Dialog";
import { ResponsiveDialog } from "../../ui/ResponsiveDialog";
import { TextField, TextFieldInput, TextFieldLabel } from "../../ui/TextField";

export const CategoryCreationModal: ParentComponent<{
	community: string;
}> = (props) => {
	const user = useUserContext();
	const community = useCommunityContext();
	const [open, setOpen] = createSignal(false);
	const [name, setName] = createSignal("");
	const [loading, setLoading] = createSignal(false);

	const handleCreate = async () => {
		setLoading(true);
		const client = clientForManagingApp(
			user.atproto.agent,
			community().community.managingApp,
		);
		const res = await client.call(colibri.category.create.main, {
			body: { community: props.community, name: name().trim() },
		});
		setLoading(false);
		if (!res.ok) {
			showError(res.error, { fallbackTitle: "Failed to create category." });
			return;
		}
		setOpen(false);
		setName("");
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
