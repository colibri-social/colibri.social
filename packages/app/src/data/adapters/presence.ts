import type { Presence as UiPresence } from "@colibri-social/ui";
import type { Presence } from "../types";

const PRESENCE: Record<Presence["onlineState"], UiPresence> = {
	online: "online",
	away: "idle",
	dnd: "dnd",
	offline: "offline",
};

export const uiPresence = (presence: Presence | undefined): UiPresence =>
	presence ? (PRESENCE[presence.onlineState] ?? "offline") : "offline";
