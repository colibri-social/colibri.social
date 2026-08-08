import type { ActorData } from "@colibri-social/lib";
import { type Component, Show } from "solid-js";
import { useCommunityContext } from "../../../contexts/Community";
import { cx } from "../../../utils/cva";
import { badgeText, useUserBadges } from "../../../utils/user-badges";
import { Badge } from "./Badge";

export const displayableNameFn = (user: ActorData) =>
	(user.data.displayName === user.handle ? undefined : user.data.displayName) ||
	user.handle?.replaceAll("at://", "") ||
	user.did;

export const DisplayableName: Component<{
	user: ActorData;
	color?: boolean | string;
	className?: string;
	badge?: boolean;
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

	const badgeVisible = () => props.color !== false && props.badge !== false;

	const { primary } = useUserBadges(() => props.user, {
		enabled: badgeVisible,
	});

	return (
		<span
			style={{ color: resolvedColor() }}
			class={cx(
				"inline-flex flex-row items-center gap-2 max-w-full",
				props.className,
			)}
		>
			<span class="truncate min-w-0">{displayableNameFn(props.user)}</span>
			<Show when={primary() && badgeVisible()}>
				<Badge text={badgeText(primary()!)} size="xs" style={primary()!} />
			</Show>
		</span>
	);
};
