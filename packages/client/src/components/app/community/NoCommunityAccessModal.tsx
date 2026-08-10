import LockSimpleFillIcon from "~icons/ph/lock-simple-fill";
import { Button } from "../../ui/Button";
import { ResponsiveDialog } from "../../ui/ResponsiveDialog";

export const NoCommunityAccessModal = (props: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) => (
	<ResponsiveDialog
		open={props.open}
		onOpenChange={props.onOpenChange}
		title="No access"
		contentClass="max-w-md"
	>
		<div class="flex flex-col gap-5">
			<div class="flex flex-row items-start gap-3">
				<span
					class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
					aria-hidden="true"
				>
					<LockSimpleFillIcon class="size-4.5" />
				</span>
				<div class="flex flex-col gap-0.5">
					<span class="text-sm font-medium leading-5">
						This channel is in another community
					</span>
					<span class="text-sm leading-5 text-muted-foreground">
						You are not a member of the community this channel belongs to, so
						there is nothing here for you to open yet. Ask someone inside it for
						an invite.
					</span>
				</div>
			</div>
			<Button class="ml-auto" onClick={() => props.onOpenChange(false)}>
				Got it
			</Button>
		</div>
	</ResponsiveDialog>
);
