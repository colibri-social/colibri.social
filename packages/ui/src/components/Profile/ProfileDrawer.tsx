import { Show } from "solid-js";
import { reducedMotionActive } from "../../utils/playback";
import { Drawer, DrawerContent } from "../Drawer/Drawer";
import { BlockedProfileFrame } from "./BlockedProfileFrame";
import {
	type ProfileAction,
	ProfileContentBody,
	ProfileContentHeader,
	type ProfileData,
} from "./ProfileContent";
import { ProfilePopoverSkeleton } from "./ProfilePopover";

export type ProfileDrawerProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	profile?: ProfileData;
	loading?: boolean;
	onAction?: (action: ProfileAction) => void;
};

export const ProfileDrawer = (props: ProfileDrawerProps) => {
	const name = () =>
		props.profile ? (props.profile.nickname ?? props.profile.displayName) : "";
	const ready = () => (!props.loading ? props.profile : undefined);
	return (
		<Drawer
			open={props.open}
			onOpenChange={props.onOpenChange}
			initialFocus="content"
		>
			<Show
				when={ready()}
				fallback={
					<DrawerContent aria-label="Loading profile">
						<ProfilePopoverSkeleton class="-mx-4 -mt-2 w-auto" />
					</DrawerContent>
				}
			>
				{(profile) => (
					<DrawerContent
						aria-label={`${name()}'s profile`}
						headerBleed
						header={
							<BlockedProfileFrame
								profile={profile()}
								open={props.open}
								class="has-[[data-profile-body]]:-mb-6"
							>
								<ProfileContentHeader
									profile={profile()}
									surface="popover"
									avatarPlay={props.open && !reducedMotionActive()}
									onAction={props.onAction}
								/>
								<ProfileContentBody
									profile={profile()}
									surface="popover"
									onAction={props.onAction}
									class="px-4 pt-4"
								/>
							</BlockedProfileFrame>
						}
					/>
				)}
			</Show>
		</Drawer>
	);
};
