import { createSignal, type ParentComponent } from "solid-js";
import { toast } from "somoto";
import XIcon from "~icons/ph/x";
import type { Invitation } from "../../../atproto/xrpc/social/colibri/community/listInvitations";
import { Button } from "../../../components/ui/Button";
import {
	Dialog,
	DialogCloseButton,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogPortal,
	DialogTrigger,
} from "../../../components/ui/Dialog";
import { useCommunityContext } from "../../../contexts/Community";
import { useUserContext } from "../../../contexts/User";
import { Spinner } from "../../icons/Spinner";

export const DeleteLinkModal: ParentComponent<{
	invitation: Invitation;
	refetch: (...args: any[]) => any | Promise<any>;
}> = (props) => {
	const user = useUserContext();
	const community = useCommunityContext();
	const uri = () => community().community.uri;

	const [loading, setLoading] = createSignal(false);
	const [open, setOpen] = createSignal(false);

	/**
	 * Deletes an invite code.
	 */
	const deleteInviteLink = async () => {
		setLoading(true);
		try {
			const res = await user.xrpc.social.colibri.community.deleteInvitation(
				uri(),
				props.invitation.code,
			);
			if (!res) {
				toast.error("Failed to delete invite link.");
				return;
			}
			props.refetch();
		} catch {
			toast.error("Failed to delete invite link.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<Dialog open={open()} onOpenChange={setOpen}>
			<DialogTrigger>{props.children}</DialogTrigger>
			<DialogPortal>
				<DialogContent class="w-128">
					<DialogCloseButton
						class="absolute top-4 right-4 cursor-pointer hover:bg-muted w-8 h-8 rounded-sm flex items-center justify-center"
						onClick={() => setOpen(false)}
					>
						<XIcon />
					</DialogCloseButton>
					<DialogHeader>
						<h2 class="m-0 text-center">Delete this invite link?</h2>
					</DialogHeader>
					<div class="flex flex-col gap-2 text-center">
						<p class="m-0">You can create new links to allow others to join.</p>
					</div>
					<DialogFooter>
						<Button
							variant="destructive"
							class="w-full"
							disabled={loading()}
							onClick={deleteInviteLink}
						>
							<Spinner
								classList={{
									hidden: !loading(),
									block: loading(),
								}}
							/>
							Leave
						</Button>
					</DialogFooter>
				</DialogContent>
			</DialogPortal>
		</Dialog>
	);
};
