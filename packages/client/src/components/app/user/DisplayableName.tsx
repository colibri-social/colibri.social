import type { ActorData } from "@colibri-social/lib";
import { Show, type Component } from "solid-js";
import { useCommunityContext } from "../../../contexts/Community";
import { Badge } from "./Badge";

export const displayableNameFn = (user: ActorData) =>
	user.data.displayName || user.handle.replaceAll("at://", "") || user.did;

export const DisplayableName: Component<{
	user: ActorData;
	color?: boolean;
}> = (props) => {
	const community = useCommunityContext();

	const getTopMemberRoleColor = () => {
		// getRolesForUser already excludes protected roles and is sorted by
		// position (highest first), so the first coloured role wins.
		const rolesForUser = community().utils.getRolesForUser(props.user.did);

		return (
			rolesForUser.find((x) => typeof x.color !== "undefined")?.color ||
			"#ffffff"
		);
	};

	return (
		<span
			style={{
				color: props.color === false ? undefined : getTopMemberRoleColor(),
			}}
			class="inline-flex flex-row items-center gap-2"
		>
			{displayableNameFn(props.user)}
			<Show when={props.user.data.isBot && props.color !== false}>
				<Badge text="BOT" size="xs" style="bot" />
			</Show>
		</span>
	);
};
