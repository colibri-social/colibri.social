import { ChatRoundLineIcon } from "@solar-icons/solid/bold/chat-round-line";
import { GamepadIcon } from "@solar-icons/solid/bold/gamepad";
import { Logout2Icon } from "@solar-icons/solid/bold/logout-2";
import { TrashBinTrashIcon } from "@solar-icons/solid/bold/trash-bin-trash";
import { UserIdIcon } from "@solar-icons/solid/bold/user-id";
import { Show } from "solid-js";
import { AtmosphereGlyph } from "../../icons/animated/brand";
import { cx } from "../../utils/cx";
import { DestructiveRow, ListGroup, NavRow, ToggleRow } from "../List/List";

export type AccountSettingsProps = {
	onEditProfile?: () => void;
	status?: string;
	onEditStatus?: () => void;
	shareActivity: boolean;
	onShareActivityChange: (share: boolean) => void;
	atmosphereAccountHref?: string;
	onLogOut?: () => void;
	onDeleteAccount?: () => void;
	class?: string;
};

export const ACCOUNT_SETTINGS_COPY = {
	profile: "Profile",
	status: "Status",
	noStatus: "Not set",
	activity: "Activity",
	shareActivity: "Share what I'm doing",
	shareActivityDescription:
		"Shows what you're playing or listening to on your profile and in the member list. Turning this off clears it for everyone right away.",
	atmosphereAccount: "My Atmosphere Account",
	logOut: "Log out",
	deleteAccount: "Delete my Colibri data",
} as const;

export const AccountSettings = (props: AccountSettingsProps) => (
	<div
		data-account-settings=""
		class={cx("flex w-full min-w-0 flex-col gap-6", props.class)}
	>
		<ListGroup label="Account">
			<Show when={props.onEditProfile}>
				<NavRow
					icon={<UserIdIcon />}
					label={ACCOUNT_SETTINGS_COPY.profile}
					keywords={["name", "picture", "bio"]}
					onClick={() => props.onEditProfile?.()}
				/>
			</Show>
			<Show when={props.onEditStatus}>
				<NavRow
					icon={<ChatRoundLineIcon />}
					label={ACCOUNT_SETTINGS_COPY.status}
					value={props.status?.trim() || ACCOUNT_SETTINGS_COPY.noStatus}
					onClick={() => props.onEditStatus?.()}
				/>
			</Show>
			<Show when={props.atmosphereAccountHref}>
				{(href) => (
					<NavRow
						icon={<AtmosphereGlyph />}
						label={ACCOUNT_SETTINGS_COPY.atmosphereAccount}
						keywords={["password", "email", "handle"]}
						href={href()}
						external
					/>
				)}
			</Show>
		</ListGroup>
		<ListGroup label={ACCOUNT_SETTINGS_COPY.activity}>
			<ToggleRow
				icon={<GamepadIcon />}
				title={ACCOUNT_SETTINGS_COPY.shareActivity}
				description={ACCOUNT_SETTINGS_COPY.shareActivityDescription}
				keywords={["listening", "playing", "music", "game"]}
				checked={props.shareActivity}
				onChange={props.onShareActivityChange}
			/>
		</ListGroup>
		<Show when={props.onLogOut || props.onDeleteAccount}>
			<ListGroup>
				<Show when={props.onLogOut}>
					<DestructiveRow
						icon={<Logout2Icon />}
						label={ACCOUNT_SETTINGS_COPY.logOut}
						keywords={["sign out"]}
						onClick={() => props.onLogOut?.()}
					/>
				</Show>
				<Show when={props.onDeleteAccount}>
					<DestructiveRow
						icon={<TrashBinTrashIcon />}
						label={ACCOUNT_SETTINGS_COPY.deleteAccount}
						keywords={["delete account", "remove"]}
						onClick={() => props.onDeleteAccount?.()}
					/>
				</Show>
			</ListGroup>
		</Show>
	</div>
);
