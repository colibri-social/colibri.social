import type { ControlsPreferences } from "../data/source";
import type { Layer, MembersLayer } from "./layers";

export const membersForward = (
	top: Layer | undefined,
): MembersLayer | undefined => {
	if (top?.kind !== "chat" && top?.kind !== "thread") return undefined;
	return { kind: "members", space: top.space, channel: top.channel };
};

export const canSwipeForward = (
	top: Layer | undefined,
	state: {
		selecting: boolean;
		swipeLeftAction: ControlsPreferences["swipeLeftAction"];
	},
) =>
	!state.selecting &&
	(!membersForward(top) || state.swipeLeftAction !== "reply");
