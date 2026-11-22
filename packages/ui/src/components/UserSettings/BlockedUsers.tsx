import { For, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { Button } from "../Button/Button";
import { ListGroup } from "../List/List";
import { MemberActionRow } from "../Members/MemberActionRow";
import type { MemberIdentityData } from "../Members/MemberIdentity";
import { SettingsEmpty, SettingsPage } from "../SettingsPages/shared";

export type BlockedUser = MemberIdentityData & {
	detail?: string;
	unblocking?: boolean;
};

export type BlockedUsersProps = {
	users: BlockedUser[];
	onUnblock: (id: string) => void;
	class?: string;
};

export const BLOCKED_USERS_COPY = {
	title: "Blocked users",
	intro:
		"You won't get notifications from people you block, and their messages stay collapsed until you choose to see them. They aren't told.",
	group: "Blocked",
	empty: "You haven't blocked anyone.",
	unblock: "Unblock",
	unblockLabel: (name: string) => `Unblock ${name}`,
} as const;

export const BlockedUsers = (props: BlockedUsersProps) => {
	return (
		<SettingsPage intro={BLOCKED_USERS_COPY.intro} class={cx(props.class)}>
			<Show
				when={props.users.length > 0}
				fallback={<SettingsEmpty>{BLOCKED_USERS_COPY.empty}</SettingsEmpty>}
			>
				<ListGroup label={BLOCKED_USERS_COPY.group} count={props.users.length}>
					<For each={props.users}>
						{(user) => (
							<MemberActionRow
								member={user}
								detail={user.detail}
								stackDetail
								actions={
									<Button
										variant="secondary"
										aria-label={BLOCKED_USERS_COPY.unblockLabel(user.name)}
										loading={user.unblocking}
										onClick={() => props.onUnblock(user.id)}
									>
										{BLOCKED_USERS_COPY.unblock}
									</Button>
								}
							/>
						)}
					</For>
				</ListGroup>
			</Show>
		</SettingsPage>
	);
};
