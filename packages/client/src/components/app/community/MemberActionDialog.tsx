import {
	type Accessor,
	createSignal,
	type ParentComponent,
	type Setter,
} from "solid-js";
import { colibri } from "../../../atproto/lexicons";
import { clientForManagingApp } from "../../../atproto/xrpc";
import { useCommunityContext } from "../../../contexts/Community";
import type { Member } from "../../../contexts/community-payload";
import { useUserContext } from "../../../contexts/User";
import { showError } from "../../../errors/show-error";
import { createLogger } from "../../../utils/logger";
import { Spinner } from "../../icons/Spinner";
import { Button } from "../../ui/Button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogPortal,
} from "../../ui/Dialog";
import { displayableNameFn } from "../user/DisplayableName";

const log = createLogger("community");

export type ActionDialogData = {
	open: boolean;
	type: "kick" | "ban";
};

export const MemberActionDialog: ParentComponent<{
	dialog: Accessor<ActionDialogData>;
	setDialog: Setter<ActionDialogData>;
	member: Member;
}> = (props) => {
	const user = useUserContext();
	const community = useCommunityContext();
	const [loading, setLoading] = createSignal(false);

	const header = () =>
		props.dialog().type === "kick"
			? `Kick ${displayableNameFn(
					{ displayName: props.member.data.displayName },
					props.member.nickname,
				)} from this community?`
			: `Ban ${displayableNameFn(
					{ displayName: props.member.data.displayName },
					props.member.nickname,
				)} from this community?`;

	const description = () =>
		props.dialog().type === "kick"
			? community().community.requiresApprovalToJoin
				? "Their request to rejoin will need approval again."
				: "They can rejoin with an invite link at any time."
			: "They lose access to this community, but their existing messages stay as they are. Revoke the ban to let them back in.";

	const handleAction = async () => {
		setLoading(true);

		const client = clientForManagingApp(
			user.atproto.agent,
			community().community.managingApp,
		);
		const body = {
			community: community().community.did,
			subject: props.member.did,
		};

		const res =
			props.dialog().type === "ban"
				? await client.call(colibri.community.ban.main, { body })
				: await client.call(colibri.community.kick.main, { body });

		if (!res.ok) {
			setLoading(false);
			const action = props.dialog().type === "ban" ? "banning" : "kicking";
			log.error(`${action} a member failed`, { code: res.error.code });
			showError(res.error, {
				fallbackTitle:
					props.dialog().type === "ban"
						? "Failed to ban user."
						: "Failed to kick user.",
			});
			return;
		}

		setLoading(false);
		props.setDialog((current) => ({ open: false, type: current.type }));
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
