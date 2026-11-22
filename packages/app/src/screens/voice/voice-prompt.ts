import { createSignal } from "solid-js";
import { voice } from "../../data/voice";

export type VoicePromptTarget = { space: string; channel: string };

const [prompt, setPrompt] = createSignal<VoicePromptTarget>();

export const voicePrompt = prompt;

export const openVoicePrompt = (target: VoicePromptTarget) => {
	if (voice.current()?.channel === target.channel) {
		setPrompt(undefined);
		voice.expand();
		return;
	}
	setPrompt({ ...target });
};

export const closeVoicePrompt = () => setPrompt(undefined);
