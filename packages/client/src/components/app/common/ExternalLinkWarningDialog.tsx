import { createEffect, onCleanup, Show } from "solid-js";
import { claimBlockingDialog } from "../../../utils/blocking-dialog";
import {
	dismissPendingExternalLink,
	pendingExternalLink,
	resolvePendingExternalLink,
} from "../../../utils/external-link-warning";
import { Button } from "../../ui/Button";
import { ResponsiveDialog } from "../../ui/ResponsiveDialog";

export const ExternalLinkWarningDialog = () => {
	createEffect(() => {
		if (!pendingExternalLink()) return;
		onCleanup(claimBlockingDialog());
	});

	return (
		<ResponsiveDialog
			open={!!pendingExternalLink()}
			onOpenChange={(open) => {
				if (!open) dismissPendingExternalLink();
			}}
			title="You're leaving Colibri"
		>
			<p class="text-muted-foreground m-0 text-sm">
				This link takes you to a site outside of Colibri. Check that you trust
				it before continuing.
			</p>
			<Show when={pendingExternalLink()}>
				{(url) => (
					<p class="bg-card text-card-foreground m-0 rounded-md border p-3 font-mono text-sm wrap-anywhere">
						{url()}
					</p>
				)}
			</Show>
			<div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
				<Button variant="ghost" onClick={dismissPendingExternalLink}>
					Cancel
				</Button>
				<Button onClick={resolvePendingExternalLink}>Continue</Button>
			</div>
		</ResponsiveDialog>
	);
};
