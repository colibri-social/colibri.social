import { createSignal, type ParentComponent } from "solid-js";
import { toast } from "somoto";
import type { Channel } from "../../../atproto/xrpc/social/colibri/community/listChannels";
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

export const ChannelSettingsModal: ParentComponent<{
	channel: Channel;
	class?: string;
}> = (props) => {
	const user = useUserContext();
	const [open, setOpen] = createSignal(false);
	const [name, setName] = createSignal(props.channel.name);
	const [loading, setLoading] = createSignal(false);

	const handleSave = async () => {
		setLoading(true);
		try {
			await user.xrpc.social.colibri.community.editChannel(props.channel.uri, name().trim());
			setOpen(false);
		} catch {
			toast.error("Failed to save channel.");
		} finally {
			setLoading(false);
		}
	};

	const handleDelete = async () => {
		setLoading(true);
		try {
			await user.xrpc.social.colibri.community.deleteChannel(props.channel.uri);
			setOpen(false);
		} catch {
			toast.error("Failed to delete channel.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<Dialog open={open()} onOpenChange={setOpen}>
			<DialogTrigger class={props.class}>{props.children}</DialogTrigger>
			<DialogPortal>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Channel Settings</DialogTitle>
					</DialogHeader>
					<TextField class="gap-1.5">
						<TextFieldLabel>Name</TextFieldLabel>
						<TextFieldInput
							value={name()}
							onInput={(e) => setName(e.currentTarget.value)}
						/>
					</TextField>
					<DialogFooter class="flex-col sm:flex-row gap-2">
						<Button
							variant="destructive"
							onClick={handleDelete}
							disabled={loading()}
							class="sm:mr-auto"
						>
							Delete Channel
						</Button>
						<Button variant="secondary" onClick={() => setOpen(false)}>
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
