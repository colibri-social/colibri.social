import {
	type Accessor,
	createContext,
	createSignal,
	type ParentComponent,
	type Setter,
	useContext,
} from "solid-js";

export type SettingsModalContextValue = {
	open: Accessor<boolean>;
	setOpen: Setter<boolean>;
};

export const SettingsModalContext = createContext<SettingsModalContextValue>();

export const SettingsModalContextProvider: ParentComponent = (props) => {
	const [open, setOpen] = createSignal<boolean>(false);

	return (
		<SettingsModalContext.Provider value={{ open, setOpen }}>
			{props.children}
		</SettingsModalContext.Provider>
	);
};

export const useSettingsModalContext = (): SettingsModalContextValue => {
	const ctx = useContext(SettingsModalContext);

	if (!ctx) {
		throw new Error("Unable to get settings modal context.");
	}

	return ctx;
};
