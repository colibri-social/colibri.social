import {
	type Accessor,
	createSignal,
	type ParentComponent,
	type Setter,
} from "solid-js";
import { useUserContext } from "../../../contexts/User";
import { useCommunityContext } from "../../../contexts/Community";
import { displayableNameFn } from "../user/DisplayableName";
import { toast } from "somoto";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogPortal,
} from "../../ui/Dialog";
import { Button } from "../../ui/Button";
import { Spinner } from "../../icons/Spinner";
import type { ActorData } from "@colibri-social/lib";

export type ActionDialogData = {
	open: boolean;
	type: "kick" | "ban";
};

export const MemberActionDialog: ParentComponent<{
	dialog: Accessor<ActionDialogData>;
	setDialog: Setter<ActionDialogData>;
	member: ActorData;
	refetch: () => void;
}> = (props) => {
	const user = useUserContext();
	const community = useCommunityContext();
	const [loading, setLoading] = createSignal(false);

	const header = () =>
		props.dialog().type === "kick"
			? `Kick ${displayableNameFn(props.member)} from this community?`
			: `Ban ${displayableNameFn(props.member)} from this community?`;

	const description = () =>
		props.dialog().type === "kick"
			? "They will be able to re-join with a link."
			: "They will be unable to rejoin unless you revoke the ban.";

	const handleAction = async () => {
		setLoading(true);

		if (props.dialog().type === "ban") {
			const data = await user.xrpc.social.colibri.community.banUser(
				community().community.uri,
				props.member.did,
			);

			if (!data) {
				setLoading(false);
				toast.error("Failed to ban user.");
				return;
			}
		} else {
			const data = await user.xrpc.social.colibri.community.kickUser(
				community().community.uri,
				props.member.did,
			);

			if (!data) {
				setLoading(false);
				toast.error("Failed to kick user.");
				return;
			}
		}

		setLoading(false);

		// TODO(app): Band-aid fix, race condition n all that. Wait for member to join via global context.
		setTimeout(props.refetch, 1000);
	};

	return (
		<Dialog open={props.dialog().open}>
			<DialogPortal>
				<DialogContent class="w-128">
					<DialogHeader>
						<h2 class="m-0 text-center">{header()}</h2>
					</DialogHeader>
					<div class="flex flex-col gap-4">
						<p class="m-0 text-center">{description()}</p>
					</div>
					<DialogFooter>
						<Button
							variant="secondary"
							disabled={loading()}
							onClick={() =>
								props.setDialog((current) => ({
									open: false,
									type: current.type,
								}))
							}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							disabled={loading()}
							onClick={handleAction}
						>
							<Spinner
								classList={{
									hidden: !loading(),
									block: loading(),
								}}
							/>
							{props.dialog().type === "kick" ? "Kick" : "Ban"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</DialogPortal>
		</Dialog>
	);
};
