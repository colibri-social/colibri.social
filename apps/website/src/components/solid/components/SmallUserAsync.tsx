import { actions } from "astro:actions";
import { createAsync, query } from "@solidjs/router";
import { type Component, Match, Show, Switch } from "solid-js";

const fetchUserData = query(async (did: string) => {
	return await actions.getUserProfileData({ did });
}, "userProfileData");

// TODO: This should be swapped out for SmallUser.tsx everywhere
export const SmallUserAsync: Component<{
	did: string;
	hideImage?: boolean;
}> = (props) => {
	const user = createAsync(() => fetchUserData(props.did));

	return (
		<Switch>
			<Match when={user()?.error}>
				<span>{props.did}</span>
			</Match>
			<Match when={user()?.data}>
				{(data) => (
					<div class="inline text-wrap">
						<Show when={!props.hideImage}>
							<img
								src={data().avatar || "/user-placeholder.png"}
								width={20}
								height={20}
								alt={data().displayName || data().handle}
								class="rounded-full inline mr-2 relative bottom-0.5"
							/>
						</Show>
						<span class="text-wrap">{data().displayName || data().handle}</span>
					</div>
				)}
			</Match>
		</Switch>
	);
};
