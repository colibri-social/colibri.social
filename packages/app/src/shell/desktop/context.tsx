import {
	type Accessor,
	createContext,
	type JSX,
	Show,
	useContext,
} from "solid-js";
import { Portal } from "solid-js/web";
import type { ThreadLayer } from "../layers";
import type { DesktopStack } from "./desktop-stack";

export type OutletName = "rail" | "header";

export type DesktopShell = {
	stack: DesktopStack;
	outlet: (name: OutletName) => Accessor<HTMLElement | undefined>;
	voiceChatOpen: Accessor<boolean>;
	setVoiceChatOpen: (open: boolean) => void;
	fullThread: Accessor<ThreadLayer | undefined>;
};

export const DesktopShellContext = createContext<DesktopShell>();

export type Placement = "main" | "pane";

export const PlacementContext = createContext<Placement>("main");

export const usePlacement = () => useContext(PlacementContext);

export const useOptionalDesktopShell = () => useContext(DesktopShellContext);

export const useDesktopShell = () => {
	const shell = useContext(DesktopShellContext);
	if (!shell) throw new Error("useDesktopShell needs the desktop shell");
	return shell;
};

export const Outlet = (props: { name: OutletName; children: JSX.Element }) => {
	const mount = useDesktopShell().outlet(props.name);
	return (
		<Show when={mount()}>
			{(node) => (
				<Portal
					mount={node()}
					ref={(wrapper) => wrapper.classList.add("contents")}
				>
					{props.children}
				</Portal>
			)}
		</Show>
	);
};
