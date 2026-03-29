import { Show } from "solid-js";

const FALLBACK_AVATAR = "/user-placeholder.png";

/**
 * User avatar, with optional status indicator.
 */
function Avatar(props: {
	user: { avatar_url?: string; display_name?: string };
	state?: string;
	size?: "small" | "base" | "large";
}) {
	return (
		<div
			class={`relative ${props.size === "small" ? "w-6 h-6" : props.size === "large" ? "w-20 h-20" : "w-10 h-10"}`}
		>
			<img
				src={props.user.avatar_url || FALLBACK_AVATAR}
				alt={props.user.display_name}
				onError={(e) => (e.currentTarget.src = FALLBACK_AVATAR)}
				width={props.size === "small" ? 24 : props.size === "large" ? 80 : 40}
				height={props.size === "small" ? 24 : props.size === "large" ? 80 : 40}
				class={`rounded-full outline-card ${props.size === "small" ? "outline" : props.size === "large" ? "outline-4" : "outline-2"}`}
			/>
			<Show when={props.state}>
				<div
					class={`rounded-full absolute bottom-px right-px outline-background ${props.size === "small" ? "w-2 h-2 outline-" : props.size === "large" ? "w-4 h-4 outline-4" : "w-2 h-2 outline-2"}`}
					classList={{
						"bg-green-500": props.state === "online",
						"bg-yellow-500": props.state === "away",
						"bg-red-500": props.state === "dnd",
						"bg-neutral-500": props.state === "offline",
					}}
				/>
			</Show>
		</div>
	);
}

export default {
	Avatar,
};
