import { actions } from "astro:actions";
import { createSignal, Match, type ParentComponent, Switch } from "solid-js";
import { toast } from "somoto";
import { parseZodToErrorOrDisplay } from "@/utils/parse-zod-to-error-or-display";
import { useGlobalContext } from "../../contexts/GlobalContext/index";
import { Spinner } from "../../icons/Spinner";
import { X } from "../../icons/X";
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
import { useNavigate } from "@solidjs/router";

export const LeaveCommunityModal: ParentComponent<{
	community: string;
	ownerDID: string;
}> = (props) => {
	const navigate = useNavigate();
	const [, { removeCommunity }] = useGlobalContext();
	const [loading, setLoading] = createSignal(false);
	const [open, setOpen] = createSignal(false);

	/**
	 * Gets an invite code for the specified community.
	 */
	const leaveCommunity = async () => {
		setLoading(true);

		const { error } = await actions.leaveCommunity({
			community: props.community,
			ownerDID: props.ownerDID,
		});

		setLoading(false);

		if (error) {
			toast.error("Failed to leave community", {
				description: parseZodToErrorOrDisplay(error.message),
			});
			return;
		}

		removeCommunity(props.community);

		navigate("/");
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
						<X />
					</DialogCloseButton>
					<DialogHeader>
						<h2 class="m-0 text-center">Leave this community?</h2>
					</DialogHeader>
					<div class="flex flex-col gap-2 text-center">
						<p class="m-0">You'll be able to re-join with an invite link.</p>
					</div>
					<DialogFooter>
						<Button
							variant="destructive"
							class="w-full"
							disabled={loading()}
							onClick={leaveCommunity}
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
