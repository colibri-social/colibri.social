import { createSignal, Match, type ParentComponent, Switch } from "solid-js";
import { toast } from "somoto";
import XIcon from "~icons/ph/x";
import { Button } from "../../../components/ui/Button";
import {
	Dialog,
	DialogCloseButton,
	DialogContent,
	DialogHeader,
	DialogPortal,
	DialogTrigger,
} from "../../../components/ui/Dialog";
import { useCommunityContext } from "../../../contexts/Community";
import { useUserContext } from "../../../contexts/User";
import { Spinner } from "../../icons/Spinner";

/**
 * A modal for creating an invitation link.
 */
export const InviteLinkCreationModal: ParentComponent<{
	generateNew?: boolean;
	refetch?: (...args: any[]) => void;
}> = (props) => {
	const user = useUserContext();
	const community = useCommunityContext();
	const uri = () => community().community.uri;
	const [code, setCode] = createSignal<string | undefined>();
	const [loading, setLoading] = createSignal(false);
	const [open, setOpen] = createSignal(false);
	const [copied, setCopied] = createSignal(false);

	/**
	 * Gets an invite code for the specified community.
	 */
	const createInviteLink = async () => {
		setLoading(true);
		const res = await user.xrpc.social.colibri.community.createInvitation(
			uri(),
		);
		setLoading(false);
		if (!res) {
			toast.error("Failed to create invite link.");
			return;
		}
		setCode(res.code);
		toast.success(`Invite code created: ${res.code}`);
		props.refetch?.();
	};

	const checkForLinkAndToggleDialog = async (open: boolean) => {
		setOpen(open);

		if (open && code() === undefined) {
			await createInviteLink();
		}
	};

	const linkText = () => `https://colibri.social/invite/${code()}`;

	const copyLink = () => {
		navigator.clipboard.writeText(linkText());
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<Dialog open={open()} onOpenChange={checkForLinkAndToggleDialog}>
			<DialogTrigger class="w-fit mx-auto">{props.children}</DialogTrigger>
			<DialogPortal>
				<DialogContent class="w-128">
					<DialogCloseButton
						class="absolute top-4 right-4 cursor-pointer hover:bg-muted w-8 h-8 rounded-sm flex items-center justify-center"
						onClick={() => setOpen(false)}
					>
						<XIcon />
					</DialogCloseButton>
					<DialogHeader>
						<h2 class="m-0 text-center text-xl font-semibold">
							Create an invitation
						</h2>
					</DialogHeader>
					<div class="flex flex-col gap-4">
						<p class="m-0 text-sm text-muted-foreground">
							Give this link to anyone you want to join this community!
						</p>
						<div class="flex flex-row items-center border border-border p-2 rounded-xl pl-4">
							<Switch>
								<Match when={!code()}>
									<Spinner
										className="h-10"
										classList={{
											hidden: !loading(),
											block: loading(),
										}}
									/>
								</Match>
								<Match when={code()}>
									<span
										class="flex-1 text-sm break-words"
										style={{
											"word-wrap": "break-word",
											"overflow-wrap": "break-word",
										}}
									>
										{linkText()}
									</span>
									<Button
										class="ml-2 px-4 py-2 text-sm"
										classList={{
											"bg-green-500! hover:bg-green-400! text-black!": copied(),
										}}
										onClick={copyLink}
									>
										<Switch>
											<Match when={copied()}>Copied!</Match>
											<Match when={!copied()}>Copy</Match>
										</Switch>
									</Button>
								</Match>
							</Switch>
						</div>
						<small class="text-xs text-muted-foreground">
							You can manage invite links via the community settings.
						</small>
					</div>
				</DialogContent>
			</DialogPortal>
		</Dialog>
	);
};
