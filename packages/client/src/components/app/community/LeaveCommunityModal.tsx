import { useNavigate } from "@solidjs/router";
import type { Accessor, Setter } from "solid-js";
import { createSignal } from "solid-js";
import { evictCommunity } from "../../../atproto/cache/community-evict";
import { namespace } from "../../../atproto/cache/keys";
import { colibri } from "../../../atproto/lexicons";
import { useUserContext } from "../../../contexts/User";
import { showError } from "../../../errors/show-error";
import { getAppViewDid } from "../../../utils/appview";
import { createLogger } from "../../../utils/logger";
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

const log = createLogger("community");

export const LeaveCommunityModal = (props: {
	open: Accessor<boolean>;
	setOpen: Setter<boolean>;
	communityName: string;
	community: string;
}) => {
	const user = useUserContext();
	const navigate = useNavigate();
	const [loading, setLoading] = createSignal(false);

	const handleLeave = async () => {
		setLoading(true);

		const res = await user.xrpc.call(colibri.community.leave.main, {
			body: { community: props.community },
		});

		setLoading(false);

		if (!res.ok) {
			log.error("leaving the community failed", { code: res.error.code });
			showError(res.error, { fallbackTitle: "Failed to leave community." });
			return;
		}

		await evictCommunity(namespace(getAppViewDid(), user.did), props.community);
		await user.refetchCommunities();

		props.setOpen(false);
		navigate("/app");
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
