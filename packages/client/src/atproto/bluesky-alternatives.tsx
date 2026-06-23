import type { Component } from "solid-js";
import { Anisota } from "../components/icons/Anisota";
import { Blacksky } from "../components/icons/Blacksky";
import { Bluesky } from "../components/icons/Bluesky";
import { DeerSocial } from "../components/icons/DeerSocial";
import { MuSocial } from "../components/icons/MuSocial";
import { Witchsky } from "../components/icons/Witchsky";

export type BlueskyClientID =
	| "anisota"
	| "blacksky"
	| "bluesky"
	| "deer"
	| "mu"
	| "witchsky";

export type BlueskyAlternative = {
	name: string;
	base: string;
	icon: Component<{ className: string }>;
	color: string;
	id: BlueskyClientID;
};

export const BSKY_ALTERNATIVES: Array<BlueskyAlternative> = [
	{
		name: "Anisota",
		base: "anisota.net",
		icon: Anisota,
		color: "#ef8f06",
		id: "anisota",
	},
	{
		name: "Blacksky",
		base: "blacksky.community",
		icon: Blacksky,
		color: "#6868b6",
		id: "blacksky",
	},
	{
		name: "Bluesky",
		base: "bsky.app",
		icon: Bluesky,
		color: "#0f73ff",
		id: "bluesky",
	},
	{
		name: "Deer Social",
		base: "deer.social",
		icon: DeerSocial,
		color: "#729f7c",
		id: "deer",
	},
	{
		name: "Mu Social",
		base: "mu.social",
		icon: MuSocial,
		color: "#db4aa6",
		id: "mu",
	},
	{
		name: "Witchsky",
		base: "witchsky.app",
		icon: Witchsky,
		color: "#ed5345",
		id: "witchsky",
	},
];

export const getBskyAlternativeClientInfo = (
	client: BlueskyClientID,
): BlueskyAlternative => BSKY_ALTERNATIVES.find((x) => x.id === client)!;
