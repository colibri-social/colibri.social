import { type Component, Show } from "solid-js";
import type { ProfileView } from "../../../atproto/views";
import { useCommunityContext } from "../../../contexts/Community";
import { cx } from "../../../utils/cva";
import { displayableNameFn } from "../../../utils/displayable-name";
import { readableUserColor } from "../../../utils/readable-color";
import { resolvedTheme } from "../../../utils/theme";
import { useUserBadges } from "../../../utils/user-badges";
import { Badge } from "./Badge";

export { displayableNameFn };

export const DisplayableName: Component<{
	user: ProfileView;
	nickname?: string;
	color?: boolean | string;
	className?: string;
	badge?: boolean;
	underlineOnHover?: boolean;
	avatarSize?: "small";
}> = (props) => {
	const community = useCommunityContext();

	const getTopMemberRoleColor = () => {
		const rolesForUser = community().utils.getRolesForUser(props.user.did);

		return rolesForUser.find((x) => typeof x.color !== "undefined")?.color;
	};

	const resolvedColor = () => {
		if (props.color === false) return undefined;

		const color =
			typeof props.color === "string" ? props.color : getTopMemberRoleColor();

		return readableUserColor(color, resolvedTheme());
	};

	const badgeVisible = () => props.color !== false && props.badge !== false;

	const { primary } = useUserBadges(() => props.user, {
		enabled: badgeVisible,
	});

	return (
		<span
			style={{
				color: resolvedColor(),
				"max-width":
					props.avatarSize === "small" ? "calc(100% - 32px)" : "100%",
			}}
			class={cx("group/name w-full", props.className)}
		>
			<span
				class="truncate min-w-0 w-full inline-block"
				classList={{
					"group-hover/name:underline": props.underlineOnHover,
				}}
			>
				{displayableNameFn(props.user, props.nickname)}
			</span>
			<Show when={primary() && badgeVisible()}>
				<Badge val={primary()!} size="xs" />
			</Show>
		</span>
	);
};
