import { StatusScreen } from "@colibri-social/ui";
import { HourglassLineIcon } from "@solar-icons/solid/bold/hourglass-line";
import { type Component, createMemo, type JSX, lazy } from "solid-js";
import { Dynamic } from "solid-js/web";
import type { Screen } from "../screen/define";
import type { AdminPage } from "./layers";

export type AdminArgs = { space: string; id?: string };

type ScreenModule<A> = { default: Screen<A> };

const adminModules = import.meta.glob<ScreenModule<AdminArgs>>(
	"../screens/admin/*/*.screen.ts",
);

const appModules = import.meta.glob<ScreenModule<Record<string, string>>>([
	"../screens/create-space/*.screen.ts",
	"../screens/discover/*.screen.ts",
	"../screens/join/*.screen.ts",
]);

const folderOf = (path: string) => path.split("/").at(-2) ?? "";

const lazyByFolder = <A,>(
	modules: Record<string, () => Promise<ScreenModule<A>>>,
) => {
	const screens = new Map<string, Component<{ args: A }>>();
	for (const [path, load] of Object.entries(modules)) {
		screens.set(folderOf(path), lazy(load));
	}
	return screens;
};

const adminScreens = lazyByFolder(adminModules);
const appScreens = lazyByFolder(appModules);

const Pending = () => (
	<StatusScreen
		tone="neutral"
		icon={<HourglassLineIcon />}
		title="Not available yet"
		description="This page arrives later in the Space management round."
	/>
);

export const AdminScreen = (props: {
	page: AdminPage;
	args: AdminArgs;
}): JSX.Element => {
	const screen = createMemo(() => adminScreens.get(props.page));
	return <Dynamic component={screen() ?? Pending} args={props.args} />;
};

export type AppScreenName = "create-space" | "discover" | "join";

export const AppScreen = (props: {
	name: AppScreenName;
	args: Record<string, string>;
}): JSX.Element => {
	const screen = createMemo(() => appScreens.get(props.name));
	return <Dynamic component={screen() ?? Pending} args={props.args} />;
};
