import { CallDebugDialog, type DiagnosticsSection } from "@colibri-social/ui";
import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { formatDiagnostics } from "../../data/debug-info";
import { voice } from "../../data/voice";
import { voiceDebugSections } from "../../data/voice/debug-sections";
import type { VoiceDebugSnapshot } from "../../data/voice/debug-stats";

const POLL_MS = 1_000;

const EMPTY_SNAPSHOT: VoiceDebugSnapshot = {
	node: null,
	failedHosts: [],
	transports: [],
	audio: [],
	video: [],
};

export const CallDebugHost = (props: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) => {
	const [sections, setSections] = createSignal<DiagnosticsSection[]>();
	const copyValue = createMemo(() => {
		const current = sections();

		return current ? formatDiagnostics(current) : undefined;
	});

	createEffect(() => {
		if (!props.open) {
			setSections(undefined);
			return;
		}

		let alive = true;

		const refresh = async () => {
			const snapshot = await voice.debugSnapshot().catch(() => null);

			if (alive) setSections(voiceDebugSections(snapshot ?? EMPTY_SNAPSHOT));
		};

		void refresh();

		const timer = setInterval(() => void refresh(), POLL_MS);

		onCleanup(() => {
			alive = false;
			clearInterval(timer);
		});
	});

	return (
		<CallDebugDialog
			open={props.open}
			onOpenChange={props.onOpenChange}
			sections={sections()}
			copyValue={copyValue()}
		/>
	);
};
