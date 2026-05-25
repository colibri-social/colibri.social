import { ActorData, OnlineState } from "lib";
import { Show } from "solid-js";
import { resolveBlob } from "../../../atproto/resolve-blob";

const FALLBACK_AVATAR = "/user-placeholder.png";

/**
 * User avatar, with optional status indicator.
 */
export function Avatar(props: {
	user: ActorData;
	size?: "small" | "base" | "large";
}) {
	return (
		<div
			class={`relative ${props.size === "small" ? "w-6 h-6" : props.size === "large" ? "w-20 h-20" : "w-10 h-10"}`}
		>
			<img
				src={
					resolveBlob(props.user.did, props.user.data.avatar) || FALLBACK_AVATAR
				}
				alt={props.user.data.displayName}
				onError={(e) => (e.currentTarget.src = FALLBACK_AVATAR)}
				width={props.size === "small" ? 24 : props.size === "large" ? 80 : 40}
				height={props.size === "small" ? 24 : props.size === "large" ? 80 : 40}
				class={`rounded-full outline-card ${props.size === "small" ? "outline" : props.size === "large" ? "outline-4" : "outline-2"}`}
			/>
			<Show when={props.user.data.onlineState}>
				<div
					class={`rounded-full absolute bottom-px right-px outline-background ${props.size === "small" ? "w-2 h-2 outline-" : props.size === "large" ? "w-4 h-4 outline-4" : "w-2 h-2 outline-2"}`}
					classList={{
						"bg-green-500": props.user.data.onlineState === "online",
						"bg-yellow-500": props.user.data.onlineState === "away",
						"bg-red-500": props.user.data.onlineState === "dnd",
						"bg-neutral-500": props.user.data.onlineState === "offline",
					}}
				/>
			</Show>
		</div>
	);
}
