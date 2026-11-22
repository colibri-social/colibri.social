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
	withoutBot?: boolean;
}) => {
	const badges = useBadges();
	return (
		<Show
			when={badges.primary(props.profile, { withoutBot: props.withoutBot })}
		>
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

export const usePrimaryBadgeOf = () => {
	const badges = useBadges();
	return (profile: BadgeProfile, options: { withoutBot?: boolean } = {}) => {
		const definition = badges.primary(profile, options);
		return definition ? <UserBadge definition={definition} /> : undefined;
	};
};
