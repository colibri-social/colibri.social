import { createContext, type ParentComponent, useContext } from "solid-js";

export type HapticImpact = "light" | "medium" | "heavy" | "rigid" | "soft";
export type HapticNotification = "success" | "warning" | "error";

export type Haptics = {
	impact: (style: HapticImpact) => void;
	selection: () => void;
	notification: (type: HapticNotification) => void;
};

const noopHaptics: Haptics = {
	impact: () => {},
	selection: () => {},
	notification: () => {},
};

const HapticsContext = createContext<Haptics>(noopHaptics);

export const HapticsProvider: ParentComponent<{ haptics: Haptics }> = (
	props,
) => (
	<HapticsContext.Provider value={props.haptics}>
		{props.children}
	</HapticsContext.Provider>
);

export const useHaptics = () => useContext(HapticsContext);
