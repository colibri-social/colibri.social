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
						You do not have access to this channel
					</span>
					<span class="text-sm leading-5 text-muted-foreground">
						You are not allowed to view this channel, or are not a member of the
						community it belongs to. Ask someone for permissions or an invite.
					</span>
				</div>
			</div>
			<Button class="ml-auto" onClick={() => props.onOpenChange(false)}>
				Got it
			</Button>
		</div>
	</ResponsiveDialog>
);
