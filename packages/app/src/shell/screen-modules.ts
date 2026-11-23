import type { Screen } from "../screen/define";

export type AdminArgs = { space: string; id?: string };

export type ScreenModule<A> = { default: Screen<A> };

export const adminModules = import.meta.glob<ScreenModule<AdminArgs>>(
	"../screens/admin/*/*.screen.ts",
);

export const appModules = import.meta.glob<
	ScreenModule<Record<string, string>>
>([
	"../screens/create-space/*.screen.ts",
	"../screens/legacy-space/*.screen.ts",
	"../screens/discover/*.screen.ts",
	"../screens/join/*.screen.ts",
	"../screens/pack/*.screen.ts",
]);
