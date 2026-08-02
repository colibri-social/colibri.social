import { getCurrentWindow } from "@tauri-apps/api/window";
import { type Accessor, createEffect, createSignal, onCleanup } from "solid-js";
import { isTauriRuntime } from "../notifications/environment";

export type ShellTitleChannel = { name: string; type: string };

export type ShellCommunity = { name: string; picture?: string };

const [community, setCommunity] = createSignal<ShellCommunity | undefined>(
	undefined,
);
const [channel, setChannel] = createSignal<ShellTitleChannel | undefined>(
	undefined,
);

export const composeShellTitle = (
	communityName: string | undefined,
	activeChannel: ShellTitleChannel | undefined,
): string => {
	if (!communityName) return "";
	if (!activeChannel) return communityName;
	return `${activeChannel.name} · ${communityName}`;
};

export const shellCommunity = community;

export const shellTitle = (): string =>
	composeShellTitle(community()?.name, channel());

export const publishShellTitle = (
	activeCommunity: Accessor<ShellCommunity | undefined>,
	activeChannel: Accessor<ShellTitleChannel | undefined>,
): void => {
	createEffect(() => setCommunity(activeCommunity()));
	createEffect(() => setChannel(activeChannel()));

	onCleanup(() => {
		setCommunity(undefined);
		setChannel(undefined);
	});
};

const TITLE_DEBOUNCE_MS = 150;

export const createNativeTitleSync = (): void => {
	let timer: ReturnType<typeof setTimeout> | undefined;

	createEffect(() => {
		const next = shellTitle() || "Colibri";

		if (timer !== undefined) clearTimeout(timer);
		timer = setTimeout(() => {
			document.title = next;
			if (isTauriRuntime()) {
				void getCurrentWindow()
					.setTitle(next)
					.catch(() => {});
			}
		}, TITLE_DEBOUNCE_MS);
	});

	onCleanup(() => {
		if (timer !== undefined) clearTimeout(timer);
	});
};
