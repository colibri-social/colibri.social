import {
	SecondaryUserBadge,
	UserBadge,
	type UserBadgeSize,
} from "@colibri-social/ui";
import { For, Show } from "solid-js";
import { type BadgeProfile, useBadges } from "../../data/badges";

export const SecondaryBadges = (props: { profile: BadgeProfile }) => {
	const badges = useBadges();
	const secondary = () => {
		const primary = badges.primary(props.profile);
		return badges
			.all(props.profile)
			.filter((entry) => entry.identifier !== primary?.identifier);
	};
	return (
		<Show when={secondary().length > 0}>
			<span data-secondary-badges="" class="flex shrink-0 items-center gap-1">
				<For each={secondary()}>
					{(definition) => <SecondaryUserBadge definition={definition} />}
				</For>
			</span>
		</Show>
	);
};

export const PrimaryBadge = (props: {
	profile: BadgeProfile;
	size?: UserBadgeSize;
	describe?: boolean;
}) => {
	const badges = useBadges();
	return (
		<Show when={badges.primary(props.profile)}>
			{(definition) => (
				<UserBadge
					definition={definition()}
					size={props.size ?? "xs"}
					describe={props.describe}
				/>
			)}
		</Show>
	);
};
