import { mergeProps, Show } from "solid-js";
import { reducedMotionActive } from "../../utils/playback";
import { Drawer, DrawerContent } from "../Drawer/Drawer";
import {
	createMemberDrawerView,
	hasMemberDrawerActions,
	MemberDrawerSections,
	MemberDrawerViewHeader,
} from "../Members/MemberDrawer";
import { BlockedProfileFrame } from "./BlockedProfileFrame";
import {
	type ProfileAction,
	ProfileContentBody,
	ProfileContentHeader,
	type ProfileData,
} from "./ProfileContent";
import {
	type ProfileMenuActions,
	ProfilePopoverSkeleton,
} from "./ProfilePopover";

export type ProfileDrawerProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	profile?: ProfileData;
	loading?: boolean;
	onAction?: (action: ProfileAction) => void;
	menu?: ProfileMenuActions;
};

export const ProfileDrawer = (props: ProfileDrawerProps) => {
	const drawer = createMemberDrawerView(() => props.open);
	const name = () =>
		props.profile ? (props.profile.nickname ?? props.profile.displayName) : "";
	const ready = () => (!props.loading ? props.profile : undefined);
	const menu = () => {
		const actions = props.menu;
		if (!actions || props.profile?.self) return undefined;

		return mergeProps(actions, { onViewProfile: undefined });
	};
	const menuRows = () => {
		const actions = menu();

		return actions && hasMemberDrawerActions(actions) ? actions : undefined;
	};
	const subview = () => (menu() ? drawer.view() !== "actions" : false);
	const close = () => props.onOpenChange(false);

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
						headerBleed={!subview()}
						onEscapeKeyDown={drawer.backToActions}
						header={
							<Show
								when={subview()}
								fallback={
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
											showActions={!menu()}
											actionGroups={
												<Show when={menuRows()}>
													{(actions) => (
														<MemberDrawerSections
															{...actions()}
															name={name()}
															view="actions"
															onViewChange={drawer.setView}
															onClose={close}
														/>
													)}
												</Show>
											}
											class="px-4 pt-4"
										/>
									</BlockedProfileFrame>
								}
							>
								<MemberDrawerViewHeader
									view={drawer.view()}
									name={name()}
									backLabel="Back to profile"
									onBack={() => drawer.setView("actions")}
								/>
							</Show>
						}
					>
						<Show when={subview() && menu()}>
							{(actions) => (
								<MemberDrawerSections
									{...actions()}
									name={name()}
									view={drawer.view()}
									onViewChange={drawer.setView}
									onClose={close}
								/>
							)}
						</Show>
					</DrawerContent>
				)}
			</Show>
		</Drawer>
	);
};
