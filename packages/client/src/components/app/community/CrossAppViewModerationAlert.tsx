import { type Component, Show } from "solid-js";
import {
	useCommunityContext,
	usePermissions,
} from "../../../contexts/Community";
import { useUserContext } from "../../../contexts/User";
import { useUserPreferences } from "../../../contexts/UserPreferences";
import { isForeignHub } from "../../../utils/cross-appview";
import { Alert, AlertDescription, AlertTitle } from "../../ui/Alert";

export const CrossAppViewModerationAlert: Component<{ class?: string }> = (
	props,
) => {
	const user = useUserContext();
	const community = useCommunityContext();
	const permissions = usePermissions();
	const preferences = useUserPreferences();

	const canModerate = () =>
		permissions.canKickMember(user.did) ||
		permissions.canBanMember(user.did) ||
		permissions.canManageRoles(user.did) ||
		permissions.canManageCommunity(user.did);

	const blocked = () =>
		isForeignHub(community().community.appview) &&
		!preferences.preferences().sharePresence &&
		canModerate();

	return (
		<Show when={blocked()}>
			<Alert variant="destructive" class={props.class}>
				<AlertTitle>Moderation is switched off for this community</AlertTitle>
				<AlertDescription>
					It's hosted on another AppView, which only accepts moderation from
					yours once you've published which AppView you use. Turn on presence
					sharing in Settings, under Preferences.
				</AlertDescription>
			</Alert>
		</Show>
	);
};
