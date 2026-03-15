import {
	type Accessor,
	type Component,
	createEffect,
	createMemo,
	createSignal,
	type ParentComponent,
	type Setter,
} from "solid-js";
import { useGlobalContext } from "../contexts/GlobalContext";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuGroupLabel,
	DropdownMenuPortal,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/components/solid/shadcn-solid/DropdownMenu";
import type { UserOnlineState } from "../contexts/GlobalContext/events";

const LABEL_MAP: Record<UserOnlineState, string> = {
	online: "Online",
	away: "Away",
	dnd: "Do Not Disturb",
	offline: "Offline",
};

const DropdownStatusSelect: ParentComponent<{
	value: Accessor<UserOnlineState>;
	setValue: Setter<UserOnlineState>;
}> = (props) => {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger>{props.children}</DropdownMenuTrigger>
			<DropdownMenuPortal>
				<DropdownMenuContent>
					<DropdownMenuGroup>
						<DropdownMenuGroupLabel class="text-xs text-muted-foreground">
							Status
						</DropdownMenuGroupLabel>
						<DropdownMenuRadioGroup value={props.value()}>
							<DropdownMenuRadioItem
								value="online"
								onSelect={() => props.setValue("online")}
								class="[&_svg]:text-green-400"
							>
								{LABEL_MAP["online"]}
							</DropdownMenuRadioItem>
							<DropdownMenuRadioItem
								value="away"
								onSelect={() => props.setValue("away")}
								class="[&_svg]:text-yellow-400"
							>
								{LABEL_MAP["away"]}
							</DropdownMenuRadioItem>
							<DropdownMenuRadioItem
								value="dnd"
								onSelect={() => props.setValue("dnd")}
								class="[&_svg]:text-red-400"
							>
								{LABEL_MAP["dnd"]}
							</DropdownMenuRadioItem>
							<DropdownMenuRadioItem
								value="offline"
								onSelect={() => props.setValue("offline")}
								class="[&_svg]:text-neutral-400"
							>
								{LABEL_MAP["offline"]}
							</DropdownMenuRadioItem>
						</DropdownMenuRadioGroup>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenuPortal>
		</DropdownMenu>
	);
};

/**
 * The user status visible in the community sidebar.
 * @todo This is mostly static right now.
 */
export const UserStatus: Component = () => {
	const [value, setValue] = createSignal<UserOnlineState>("online");
	const [globalData, { sendSocketMessage }] = useGlobalContext();

	const optimisticUserProfile = createMemo(() => {
		const optimisticProfileUpdates = globalData.memberProfileOverrides.find(
			(x) => x.did === globalData.user.sub,
		);
		const optimisticStatusUpdates = globalData.memberStatusOverrides.find(
			(x) => x.did === globalData.user.sub,
		);

		return {
			avatar_url:
				optimisticProfileUpdates?.avatar_url || globalData.user.avatar,
			banner_url:
				optimisticProfileUpdates?.banner_url || globalData.user.banner,
			display_name:
				optimisticProfileUpdates?.display_name || globalData.user.displayName,
			state: optimisticStatusUpdates?.state || "online",
		};
	});

	createEffect(() => {
		const state = value();

		sendSocketMessage({
			action: "set_state",
			state: state,
		});
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
				<DropdownStatusSelect value={value} setValue={setValue}>
					<div class="flex gap-2 items-center hover:underline cursor-pointer">
						<div
							class="w-2 h-2 min-w-2 min-h-2 rounded-full"
							classList={{
								"bg-green-400": optimisticUserProfile().state === "online",
								"bg-yellow-400": optimisticUserProfile().state === "away",
								"bg-red-400": optimisticUserProfile().state === "dnd",
								"bg-neutral-400": optimisticUserProfile().state === "offline",
							}}
						/>
						<span class="text-sm text-muted-foreground">
							{LABEL_MAP[optimisticUserProfile().state]}
						</span>
					</div>
				</DropdownStatusSelect>
			</div>
		</div>
	);
};
