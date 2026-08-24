import { createSignal, type ParentComponent } from "solid-js";
import { colibri } from "../../../atproto/lexicons";
import type { InvitationView } from "../../../atproto/views";
import { clientForManagingApp } from "../../../atproto/xrpc";
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
import { showError } from "../../../errors/show-error";
import { Spinner } from "../../icons/Spinner";

export const DeleteLinkModal: ParentComponent<{
	invitation: InvitationView;
	refetch: (...args: any[]) => any | Promise<any>;
}> = (props) => {
	const user = useUserContext();
	const community = useCommunityContext();

	const [loading, setLoading] = createSignal(false);
	const [open, setOpen] = createSignal(false);

	const deleteInviteLink = async () => {
		setLoading(true);
		const client = clientForManagingApp(
			user.atproto.agent,
			community().community.managingApp,
		);
		const res = await client.call(colibri.community.deleteInvitation.main, {
			body: {
				community: community().community.did,
				code: props.invitation.code,
			},
		});
		setLoading(false);
		if (!res.ok) {
			showError(res.error, { fallbackTitle: "Failed to delete invite link." });
			return;
		}
		props.refetch();
		setOpen(false);
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
