import type { ProfileTheme } from "@colibri-social/lib";
import type { Component } from "solid-js";
import { ColorPicker } from "../../ui/ColorPicker";
import {
	Tabs,
	TabsContent,
	TabsIndicator,
	TabsList,
	TabsTrigger,
} from "../../ui/Tabs";

/**
 * Local editing state for the Colibri-only profile theme
 * (`social.colibri.actor.profile.theme`). Shared by the first-login setup flow
 * and the settings editor so the controls + (de)serialization stay in one place.
 */
export type ThemeState = {
	accentColor: string;
	bannerColor: string;
	useGradient: boolean;
	gradientPrimary: string;
	gradientSecondary: string;
};

export const DEFAULT_ACCENT = "#ffffff";
export const DEFAULT_BANNER = "#11111b";
export const DEFAULT_GRADIENT_SECONDARY = "#e64980";

export const emptyThemeState = (): ThemeState => ({
	accentColor: DEFAULT_ACCENT,
	bannerColor: DEFAULT_BANNER,
	useGradient: false,
	gradientPrimary: DEFAULT_ACCENT,
	gradientSecondary: DEFAULT_GRADIENT_SECONDARY,
});

/** Builds an editing state from a stored theme (e.g. from `getData`). */
export const themeStateFromTheme = (theme?: ProfileTheme): ThemeState => {
	if (!theme) return emptyThemeState();
	return {
		accentColor: theme.accentColor ?? DEFAULT_ACCENT,
		bannerColor: theme.bannerColor ?? DEFAULT_BANNER,
		useGradient: theme.gradient !== undefined,
		gradientPrimary: theme.gradient?.primary ?? DEFAULT_ACCENT,
		gradientSecondary: theme.gradient?.secondary ?? DEFAULT_GRADIENT_SECONDARY,
	};
};

/** Serializes the editing state into a record `theme` object. */
export const themeStateToRecord = (s: ThemeState): ProfileTheme => {
	const theme: ProfileTheme = {
		accentColor: s.accentColor,
		bannerColor: s.bannerColor,
	};
	if (s.useGradient) {
		theme.gradient = {
			primary: s.gradientPrimary,
			secondary: s.gradientSecondary,
		};
	}
	return theme;
};

const ColorRow: Component<{
	label: string;
	value: string;
	onChange: (value: string) => void;
}> = (props) => (
	<div class="flex flex-row items-center justify-between gap-3 text-sm">
		<span>{props.label}</span>
		<ColorPicker value={props.value} onChange={props.onChange} />
	</div>
);

/**
 * The theming controls: an accent color (applied to the display name) plus the
 * banner background, which is either a solid fallback color or a gradient —
 * chosen via tabs. The active tab drives {@link ThemeState.useGradient}.
 */
export const ThemeControls: Component<{
	state: ThemeState;
	setState: (patch: Partial<ThemeState>) => void;
}> = (props) => (
	<div class="w-full flex flex-col gap-3 rounded-md border border-border p-3">
		<ColorRow
			label="Name color"
			value={props.state.accentColor}
			onChange={(v) => props.setState({ accentColor: v })}
		/>
		<Tabs
			value={props.state.useGradient ? "gradient" : "solid"}
			onChange={(v) => props.setState({ useGradient: v === "gradient" })}
		>
			<TabsList class="w-full">
				<TabsTrigger value="solid">Solid color</TabsTrigger>
				<TabsTrigger value="gradient">Gradient</TabsTrigger>
				<TabsIndicator />
			</TabsList>
			<TabsContent value="solid" class="pt-2">
				<ColorRow
					label="Banner color"
					value={props.state.bannerColor}
					onChange={(v) => props.setState({ bannerColor: v })}
				/>
			</TabsContent>
			<TabsContent value="gradient" class="pt-2">
				<div class="flex flex-col gap-4">
					<div class="flex-1">
						<ColorRow
							label="Primary"
							value={props.state.gradientPrimary}
							onChange={(v) => props.setState({ gradientPrimary: v })}
						/>
					</div>
					<div class="flex-1">
						<ColorRow
							label="Secondary"
							value={props.state.gradientSecondary}
							onChange={(v) => props.setState({ gradientSecondary: v })}
						/>
					</div>
				</div>
			</TabsContent>
		</Tabs>
	</div>
);
