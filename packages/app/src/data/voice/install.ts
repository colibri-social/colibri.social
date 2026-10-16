import { createSimulatedConnection } from "../mock/voice-connection";
import type { ServiceAuthAgent } from "../remote/live/connection";
import { setVoiceConnectionMonitor, voice } from "../voice";
import { voiceSettings } from "../voice-settings";
import { createVoiceEngine, type VoiceEngineOptions } from "./engine";
import { participantVolumes } from "./volumes";

export type VoiceEngineInstall = {
	agent: ServiceAuthAgent;
	appViewHost: string;
	serviceRef: string;
	viewerDid: string;
} & Partial<VoiceEngineOptions>;

export const installVoiceEngine = (options: VoiceEngineInstall) => {
	const engine = createVoiceEngine({
		settings: voiceSettings().settings,
		volumes: participantVolumes().volumes,
		...options,
	});
	setVoiceConnectionMonitor(engine);
	return () => {
		voice.leave();
		setVoiceConnectionMonitor(createSimulatedConnection());
		engine.dispose();
	};
};
