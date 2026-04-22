import { actions } from "astro:actions";
import { createSignal, type ParentComponent } from "solid-js";
import { toast } from "somoto";
import { Icon } from "@/components/solid/icons/Icon";
import { parseZodToErrorOrDisplay } from "@/utils/parse-zod-to-error-or-display";
import { Spinner } from "../../icons/Spinner";
import { Button } from "../../shadcn-solid/Button";
import {
	Dialog,
	DialogCloseButton,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogPortal,
	DialogTrigger,
} from "../../shadcn-solid/Dialog";

export const DeleteLinkModal: ParentComponent<{
	code: string;
	ownerDID: string;
	refetch: (...args: any[]) => any | Promise<any>;
}> = (props) => {
	const [loading, setLoading] = createSignal(false);
	const [open, setOpen] = createSignal(false);

	/**
	 * Deletes an invite code.
	 */
	const deleteInviteLink = async () => {
		setLoading(true);

		const { error } = await actions.deleteInviteCode({
			code: props.code,
			owner: props.ownerDID,
		});

		setLoading(false);

		if (error) {
			toast.error("Failed to delete invite link", {
				description: parseZodToErrorOrDisplay(error.message),
			});
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
					<DialogCloseButton
						class="absolute top-4 right-4 cursor-pointer hover:bg-muted w-8 h-8 rounded-sm flex items-center justify-center"
						onClick={() => setOpen(false)}
					>
						<Icon variant="regular" name="x-icon" />
					</DialogCloseButton>
					<DialogHeader>
						<h2 class="m-0 text-center">Delete this invite link?</h2>
					</DialogHeader>
					<div class="flex flex-col gap-2 text-center">
						<p class="m-0">You can create new links to allow others to join.</p>
					</div>
					<DialogFooter>
						<Button
							variant="destructive"
							class="w-full"
							disabled={loading()}
							onClick={deleteInviteLink}
						>
							<Spinner
								classList={{
									hidden: !loading(),
									block: loading(),
								}}
							/>
							Leave
						</Button>
					</DialogFooter>
				</DialogContent>
			</DialogPortal>
		</Dialog>
	);
};
