import { type Component, Show } from "solid-js";
import XIcon from "~icons/ph/x";
import { useMemberProfileContext } from "../../../contexts/MemberProfile";
import {
	Dialog,
	DialogCloseButton,
	DialogContent,
	DialogPortal,
} from "../../ui/Dialog";
import User from "../user";

// NOTE: unfinished & left here for future development work
export const MemberProfileModal: Component = () => {
	const memberProfile = useMemberProfileContext();

	return (
		<Dialog open={memberProfile.open()} onOpenChange={memberProfile.setOpen}>
			<DialogPortal>
				<DialogContent>
					<Show when={memberProfile.data()}>
						{(resolved) => (
							<>
								<div class="absolute top-4 right-4 flex items-center justify-center w-6 h-6 hover:bg-muted/50 cursor-pointer rounded-sm z-20">
									<DialogCloseButton class="absolute cursor-pointer">
										<XIcon />
									</DialogCloseButton>
								</div>
								<div class="flex flex-row gap-4">
									<div class="rounded-t-sm overflow-hidden w-80">
										<User.ProfilePopoverContents user={resolved()} />
									</div>
									<div>
										<span>n Mutual Communities</span>
									</div>
								</div>
							</>
						)}
					</Show>
				</DialogContent>
			</DialogPortal>
		</Dialog>
	);
};
