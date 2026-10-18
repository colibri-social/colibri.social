import type { AttachmentView, Did, LinkEmbed } from "../types";
import type { RichTextValue } from "./rich";

export type ForwardSeed = {
	space: string;
	channel: string;
	channelName: string;
	by: string;
	text: string | RichTextValue;
	files?: AttachmentView[];
	minutesBefore: number;
	hidden?: boolean;
};

export type ScriptEntry = {
	id?: string;
	by: string;
	text: string | RichTextValue;
	gap?: number;
	files?: AttachmentView[];
	reply?: string;
	replyDeleted?: boolean;
	react?: [string, ...string[]][];
	extraReactions?: Record<string, number>;
	edited?: boolean;
	forward?: ForwardSeed;
	embeds?: LinkEmbed[];
	suppress?: string[];
	hidden?: boolean;
};

export type ScriptContext = {
	did: (key: string) => Did;
	at: (minutesFromNow: number) => string;
};
