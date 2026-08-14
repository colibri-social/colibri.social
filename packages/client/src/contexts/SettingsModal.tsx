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
	page: Accessor<string | undefined>;
	setPage: Setter<string | undefined>;
	openPage: (id: string) => void;
};

export const SettingsModalContext = createContext<SettingsModalContextValue>();

export const SettingsModalContextProvider: ParentComponent = (props) => {
	const [open, setOpen] = createSignal<boolean>(false);
	const [page, setPage] = createSignal<string | undefined>(undefined);

	const openPage = (id: string): void => {
		setPage(id);
		setOpen(true);
	};

	return (
		<SettingsModalContext.Provider
			value={{ open, setOpen, page, setPage, openPage }}
		>
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
