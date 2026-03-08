import { actions } from "astro:actions";
import { createSignal, Match, Switch, type ParentComponent } from "solid-js";
import { toast } from "somoto";
import { parseZodToErrorOrDisplay } from "@/utils/parse-zod-to-error-or-display";
import { useGlobalContext } from "../../contexts/GlobalContext/index";
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
import {
	TextField,
	TextFieldDescription,
	TextFieldInput,
	TextFieldLabel,
} from "../../shadcn-solid/text-field";
import { useParams } from "@solidjs/router";
import { X } from "../../icons/X";

/**
 * A modal for creating an invitation link.
 */
export const InviteLinkCreationModal: ParentComponent<{ community: string }> = (
	props,
) => {
	const params = useParams();

	const [globalData] = useGlobalContext();
	const [link, setLink] = createSignal<string | undefined>();
	const [loading, setLoading] = createSignal(false);
	const [open, setOpen] = createSignal(false);
	const [copied, setCopied] = createSignal(false);

	/**
	 * Gets an invite code for the specified community.
	 */
	const createInviteLink = async () => {
		setLoading(true);

		const { error, data } = await actions.createInviteCode({
			community: props.community,
			owner: globalData.user.sub,
		});

		setLoading(false);

		if (error) {
			toast.error("Failed to create link", {
				description: parseZodToErrorOrDisplay(error.message),
			});
			return;
		}

		setLink(data);

		return;
	};

	const checkForLinkAndToggleDialog = async (open: boolean) => {
		setOpen(open);

		if (open && link() === undefined) {
			await createInviteLink();
		}
	};

	const linkText = () => `https://colibri.social/invite/${link()}`;

	const copyLink = () => {
		navigator.clipboard.writeText(linkText());
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<Dialog open={open()} onOpenChange={checkForLinkAndToggleDialog}>
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
						<h2 class="m-0 text-center">Create an invitation</h2>
					</DialogHeader>
					<div class="flex flex-col gap-2">
						<p class="m-0">
							Give this link to anyone you want to join this community!
						</p>
						<div class="flex flex-row items-center border border-border p-1 py-0.5 rounded-xl pl-4">
							<Switch>
								<Match when={!link()}>
									<Spinner
										className="h-10"
										classList={{
											hidden: !loading(),
											block: loading(),
										}}
									/>
								</Match>
								<Match when={link()}>
									<span class="w-full h-10 flex items-center">
										{linkText()}
									</span>
									<Button
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
							<span>{}</span>
						</div>
						<small class="text-muted-foreground">
							You can manage invite links via the community settings.
						</small>
					</div>
				</DialogContent>
			</DialogPortal>
		</Dialog>
	);
};
