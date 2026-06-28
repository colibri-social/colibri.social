import type { ProfileTheme } from "@colibri-social/lib";
import { type Component, Show } from "solid-js";
import {
	SwitchControl,
	SwitchInput,
	SwitchLabel,
	SwitchThumb,
	Switch as Toggle,
} from "../../ui/Switch";

/**
 * Local editing state for the Colibri-only profile theme
 * (`social.colibri.actor.profile.theme`). Shared by the first-login setup flow
 * and the settings editor so the controls + (de)serialization stay in one place.
 */
export type ThemeState = {
	customizeTheme: boolean;
	accentColor: string;
	bannerColor: string;
	useGradient: boolean;
	gradientPrimary: string;
	gradientSecondary: string;
};

export const DEFAULT_ACCENT = "#6d5ae6";
export const DEFAULT_BANNER = "#11111b";
export const DEFAULT_GRADIENT_SECONDARY = "#e64980";

export const emptyThemeState = (): ThemeState => ({
	customizeTheme: false,
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
		customizeTheme: true,
		accentColor: theme.accentColor ?? DEFAULT_ACCENT,
		bannerColor: theme.bannerColor ?? DEFAULT_BANNER,
		useGradient: theme.gradient !== undefined,
		gradientPrimary: theme.gradient?.primary ?? DEFAULT_ACCENT,
		gradientSecondary: theme.gradient?.secondary ?? DEFAULT_GRADIENT_SECONDARY,
	};
};

/** Serializes the editing state into a record `theme` object, or `undefined`. */
export const themeStateToRecord = (s: ThemeState): ProfileTheme | undefined => {
	if (!s.customizeTheme) return undefined;
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
	<label class="flex flex-row items-center justify-between text-sm">
		<span>{props.label}</span>
		<input
			type="color"
			value={props.value}
			onInput={(e) => props.onChange(e.currentTarget.value)}
			class="h-8 w-12 rounded border border-border bg-transparent"
		/>
	</label>
);

/** The theming controls (accent / banner color + optional gradient). */
export const ThemeControls: Component<{
	state: ThemeState;
	setState: (patch: Partial<ThemeState>) => void;
}> = (props) => (
	<div class="w-full flex flex-col gap-3">
		<Toggle
			class="flex flex-row gap-4 items-center w-full justify-between"
			checked={props.state.customizeTheme}
			onChange={(c) => props.setState({ customizeTheme: c })}
		>
			<SwitchLabel>Customize appearance</SwitchLabel>
			<div>
				<SwitchInput />
				<SwitchControl>
					<SwitchThumb />
				</SwitchControl>
			</div>
		</Toggle>

		<Show when={props.state.customizeTheme}>
			<div class="w-full flex flex-col gap-3 rounded-md border border-border p-3">
				<ColorRow
					label="Accent color"
					value={props.state.accentColor}
					onChange={(v) => props.setState({ accentColor: v })}
				/>
				<ColorRow
					label="Banner fallback color"
					value={props.state.bannerColor}
					onChange={(v) => props.setState({ bannerColor: v })}
				/>
				<Toggle
					class="flex flex-row gap-4 items-center w-full justify-between"
					checked={props.state.useGradient}
					onChange={(c) => props.setState({ useGradient: c })}
				>
					<SwitchLabel>Use a gradient theme</SwitchLabel>
					<div>
						<SwitchInput />
						<SwitchControl>
							<SwitchThumb />
						</SwitchControl>
					</div>
				</Toggle>
				<Show when={props.state.useGradient}>
					<div class="flex flex-row gap-4">
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
				</Show>
			</div>
		</Show>
	</div>
);
