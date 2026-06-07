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
	RadioGroup,
	RadioGroupItem,
	RadioGroupItemControl,
	RadioGroupItemLabel,
} from "../../ui/RadioGroup";
import { TextField, TextFieldInput, TextFieldLabel } from "../../ui/TextField";

export const ChannelCreationModal: ParentComponent<{
	/** AT-URI of the category this channel will belong to. */
	category: string;
	/** AT-URI of the community this channel will belong to. */
	community: string;
}> = (props) => {
	const user = useUserContext();
	const [open, setOpen] = createSignal(false);
	const [name, setName] = createSignal("");
	const [type, setType] = createSignal<"text" | "voice">("text");
	const [loading, setLoading] = createSignal(false);

	const handleCreate = async () => {
		setLoading(true);
		try {
			await user.xrpc.social.colibri.community.createChannel(
				props.community,
				props.category,
				name().trim(),
				`social.colibri.channel.${type()}`,
			);
			setOpen(false);
			setName("");
			setType("text");
		} catch {
			toast.error("Failed to create channel.");
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
						<DialogTitle>Create Channel</DialogTitle>
					</DialogHeader>
					<div class="flex flex-col gap-4">
						<TextField class="gap-1.5">
							<TextFieldLabel>Name</TextFieldLabel>
							<TextFieldInput
								placeholder="new-channel"
								value={name()}
								onInput={(e) => setName(e.currentTarget.value)}
							/>
						</TextField>
						<div class="flex flex-col gap-2">
							<span class="text-sm font-medium">Channel Type</span>
							<RadioGroup
								value={type()}
								onChange={(v) => setType(v as "text" | "voice")}
								class="flex flex-col gap-2"
							>
								<RadioGroupItem value="text" class="flex items-center gap-2">
									<RadioGroupItemControl />
									<RadioGroupItemLabel>Text channel</RadioGroupItemLabel>
								</RadioGroupItem>
								<RadioGroupItem value="voice" class="flex items-center gap-2">
									<RadioGroupItemControl />
									<RadioGroupItemLabel>Voice channel</RadioGroupItemLabel>
								</RadioGroupItem>
							</RadioGroup>
						</div>
					</div>
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
