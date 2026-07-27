import { createSignal, type ParentComponent } from "solid-js";
import { toast } from "somoto";
import type { Invitation } from "../../../atproto/xrpc/social/colibri/community/listInvitations";
import { Button } from "../../../components/ui/Button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogPortal,
	DialogTitle,
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
			setOpen(false);
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
					<DialogHeader>
						<DialogTitle>Delete this invite link?</DialogTitle>
					</DialogHeader>
					<p class="text-sm text-muted-foreground">
						This link will stop working immediately. You can create new links to
						allow others to join.
					</p>
					<DialogFooter class="flex-col sm:flex-row gap-2">
						<Button
							class="ml-auto"
							variant="secondary"
							onClick={() => setOpen(false)}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							disabled={loading()}
							onClick={deleteInviteLink}
						>
							<Spinner
								classList={{
									hidden: !loading(),
									block: loading(),
								}}
							/>
							Delete Link
						</Button>
					</DialogFooter>
				</DialogContent>
			</DialogPortal>
		</Dialog>
	);
};
