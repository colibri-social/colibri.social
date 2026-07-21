import type { OnlineState } from "@colibri-social/lib";
import type { Component } from "solid-js";
import CaretRightIcon from "~icons/ph/caret-right";
import { useCommunityContext } from "../../../contexts/Community";
import { useUserContext } from "../../../contexts/User";
import {
	DropdownStatusSelect,
	STATE_LABELS,
	STATE_OPTIONS,
} from "./StatusSelect";

export const SelfProfileActions: Component = () => {
	const user = useUserContext();
	const community = useCommunityContext();

	const onlineState = (): OnlineState => user.data.onlineState;
	const onlineDot = () =>
		STATE_OPTIONS.find((s) => s.value === onlineState())?.dot ?? "";

	return (
		<DropdownStatusSelect
			value={onlineState()}
			setValue={(e) => {
				const next = typeof e === "string" ? e : e(onlineState());
				user.xrpc.social.colibri.actor.setState(next);
				user.updateActorData({ onlineState: next });
				community().utils.patchMember(user.did, { onlineState: next });
			}}
		>
			<button
				type="button"
				class="w-full flex flex-row items-center gap-3 px-2 py-2 rounded-sm hover:bg-muted/50 cursor-pointer text-left text-sm"
			>
				<span
					class={`w-2.5 h-2.5 mx-0.75 rounded-full shrink-0 ${onlineDot()}`}
				/>
				<span class="flex-1">{STATE_LABELS[onlineState()]}</span>
				<CaretRightIcon class="text-muted-foreground" />
			</button>
		</DropdownStatusSelect>
	);
};
