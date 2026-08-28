import type { Component } from "solid-js";
import { Anisota } from "../components/icons/Anisota";
import { Blacksky } from "../components/icons/Blacksky";
import { Bluesky } from "../components/icons/Bluesky";
import { DeerSocial } from "../components/icons/DeerSocial";
import { MuSocial } from "../components/icons/MuSocial";
import { Northsky } from "../components/icons/Northsky";
import { Witchsky } from "../components/icons/Witchsky";
import type { BlueskyClientID } from "./bluesky-alternatives";

export type BlueskyClientIcon = Component<{ className: string }>;

const ICONS: Record<BlueskyClientID, BlueskyClientIcon | null> = {
	anisota: Anisota,
	blacksky: Blacksky,
	bluesky: Bluesky,
	custom: null,
	deer: DeerSocial,
	mu: MuSocial,
	northsky: Northsky,
	witchsky: Witchsky,
};

export const blueskyClientIcon = (
	id: BlueskyClientID,
): BlueskyClientIcon | null => ICONS[id];
