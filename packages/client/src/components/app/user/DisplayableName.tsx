import type { ActorData } from "@colibri-social/lib";
import { Show, type Component } from "solid-js";
import { useCommunityContext } from "../../../contexts/Community";
import { Badge } from "./Badge";

export const displayableNameFn = (user: ActorData) =>
	user.data.displayName || user.handle.replaceAll("at://", "") || user.did;

export const DisplayableName: Component<{
	user: ActorData;
	/**
	 * Name color: `false` disables coloring, a string forces that exact color
	 * (e.g. a profile's accent on its popover), and anything else falls back to
	 * the user's top role color.
	 */
	color?: boolean | string;
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

	const resolvedColor = () => {
		if (props.color === false) return undefined;
		if (typeof props.color === "string") return props.color;
		return getTopMemberRoleColor();
	};

	return (
		<span
			style={{ color: resolvedColor() }}
			class="inline-flex flex-row items-center gap-2"
		>
			{displayableNameFn(props.user)}
			<Show when={props.user.data.isBot && props.color !== false}>
				<Badge text="BOT" size="xs" style="bot" />
			</Show>
		</span>
	);
};
