import VoiceScreen from "./voice.screen";

export default function VoiceStage(props: { space: string; channel: string }) {
	return <VoiceScreen args={{ space: props.space, channel: props.channel }} />;
}
