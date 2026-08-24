import type { Component } from "solid-js";
import CaretRightIcon from "~icons/ph/caret-right";
import { colibri } from "../../../atproto/lexicons";
import { useCommunityContext } from "../../../contexts/Community";
import type { OnlineState } from "../../../contexts/community-payload";
import { normalizeOnlineState } from "../../../contexts/community-payload";
import { useUserContext } from "../../../contexts/User";
import { showError } from "../../../errors/show-error";
import {
	DropdownStatusSelect,
	STATE_LABELS,
	STATE_OPTIONS,
} from "./StatusSelect";

export const SelfProfileActions: Component = () => {
	const user = useUserContext();
	const community = useCommunityContext();

	const onlineState = (): OnlineState =>
		normalizeOnlineState(user.presence?.onlineState);
	const onlineDot = () =>
		STATE_OPTIONS.find((s) => s.value === onlineState())?.dot ?? "";

	const setOnlineState = async (next: OnlineState) => {
		const res = await user.xrpc.call(colibri.actor.setStatus.main, {
			body: { onlineState: next },
		});
		if (!res.ok) {
			showError(res.error);
			return;
		}
		user.updateProfile({ presence: res.data.presence });
		community().utils.patchMember(user.did, { onlineState: next });
	};

	return (
		<DropdownStatusSelect
			value={onlineState()}
			setValue={(e) => {
				const next = typeof e === "string" ? e : e(onlineState());
				void setOnlineState(next);
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
