import { type Component, createMemo } from "solid-js";
import { useGlobalContext } from "../contexts/GlobalContext";

/**
 * The user status visible in the community sidebar.
 * @todo This is mostly static right now.
 */
export const UserStatus: Component = () => {
	const [globalData] = useGlobalContext();

	const optimisticUserProfile = createMemo(() => {
		const optimisticProfileUpdates = globalData.memberProfileOverrides.find(
			(x) => x.did === globalData.user.sub,
		);

		return {
			avatar_url:
				optimisticProfileUpdates?.avatar_url || globalData.user.avatar,
			banner_url:
				optimisticProfileUpdates?.banner_url || globalData.user.banner,
			display_name:
				optimisticProfileUpdates?.display_name || globalData.user.displayName,
		};
	});

	return (
		<div class="w-full h-16 flex flex-row gap-3 px-4 py-3 bg-card">
			<img
				src={optimisticUserProfile().avatar_url || "/user-placeholder.png"}
				alt={optimisticUserProfile().display_name}
				class="w-10 h-10 min-w-10 min-h-10 bg-muted rounded-full border border-border"
			/>
			<div class="flex flex-col">
				<span class="font-bold leading-5">
					{optimisticUserProfile().display_name}
				</span>
				<div class="flex gap-2 items-center">
					<div class="w-2 h-2 min-w-2 min-h-2 bg-green-300 rounded-full"></div>
					<span class="text-sm text-muted-foreground">Online</span>
				</div>
			</div>
		</div>
	);
};
