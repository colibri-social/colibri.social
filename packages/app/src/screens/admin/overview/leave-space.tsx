import { ConfirmDialog, toast } from "@colibri-social/ui";
import { createSignal, Show } from "solid-js";
import { useData } from "../../../data/store";
import type { CommunityView } from "../../../data/types";
import { useStack } from "../../../shell/stack";
import { moveOffSpace } from "../space-admin";

export const LEAVE_SPACE_COPY = {
	title: (name: string) => `Leave ${name}?`,
	description:
		"You will no longer be able to view or send messages in this Space. You can rejoin with an invite link.",
	confirm: "Leave Space",
	soleOwner: "You're the owner of this Space, so you can't leave it.",
	failed: "Couldn't leave the Space",
} as const;

export const createLeaveSpace = () => {
	const data = useData();
	const stack = useStack();
	const [target, setTarget] = createSignal<CommunityView>();
	const [open, setOpen] = createSignal(false);

	const leave = async () => {
		const community = target();
		if (!community) return;
		try {
			await data.community.leave(community.did);
		} catch (error) {
			toast.error(
				error instanceof Error && error.message === "SoleOwner"
					? LEAVE_SPACE_COPY.soleOwner
					: LEAVE_SPACE_COPY.failed,
			);
			throw error;
		}
		moveOffSpace(data, stack, community.did);
		toast.success(`You left ${community.name}`);
	};

	const Dialog = () => (
		<Show when={target()}>
			{(community) => (
				<ConfirmDialog
					open={open()}
					onOpenChange={setOpen}
					title={LEAVE_SPACE_COPY.title(community().name)}
					description={LEAVE_SPACE_COPY.description}
					confirmLabel={LEAVE_SPACE_COPY.confirm}
					tone="destructive"
					onConfirm={leave}
				/>
			)}
		</Show>
	);

	return {
		open: (community: CommunityView) => {
			setTarget(community);
			setOpen(true);
		},
		Dialog,
	};
};
