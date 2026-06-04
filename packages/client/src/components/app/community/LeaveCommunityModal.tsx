import type { Accessor, Setter } from "solid-js";
import { toast } from "somoto";
import { useUserContext } from "../../../contexts/User";
import { Button } from "../../ui/Button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogPortal,
	DialogTitle,
} from "../../ui/Dialog";
import { useNavigate } from "@solidjs/router";
import { createSignal } from "solid-js";

export const LeaveCommunityModal = (props: {
	open: Accessor<boolean>;
	setOpen: Setter<boolean>;
	communityName: string;
	communityUri: string;
}) => {
	const user = useUserContext();
	const navigate = useNavigate();
	const [loading, setLoading] = createSignal(false);

	const handleLeave = async () => {
		setLoading(true);
		try {
			await user.xrpc.social.colibri.community.leave(props.communityUri);
			props.setOpen(false);
			navigate("/app");
		} catch {
			toast.error("Failed to leave community.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<Dialog open={props.open()} onOpenChange={props.setOpen}>
			<DialogPortal>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Leave {props.communityName}?</DialogTitle>
						<DialogDescription>
							You will no longer be able to view or send messages in this
							community. You can rejoin with an invite link.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="secondary" onClick={() => props.setOpen(false)}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleLeave}
							disabled={loading()}
						>
							Leave Community
						</Button>
					</DialogFooter>
				</DialogContent>
			</DialogPortal>
		</Dialog>
	);
};
