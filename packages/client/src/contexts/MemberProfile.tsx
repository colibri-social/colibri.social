import {
	type Accessor,
	createContext,
	createEffect,
	createSignal,
	type ParentComponent,
	type Setter,
	useContext,
} from "solid-js";
import type { ProfileView } from "../atproto/views";

export type MemberProfileContextValue = {
	data: Accessor<ProfileView | undefined>;
	setData: Setter<ProfileView | undefined>;
	open: Accessor<boolean>;
	setOpen: Setter<boolean>;
};

export const MemberProfileContext = createContext<MemberProfileContextValue>();

export const MemberProfileContextProvider: ParentComponent = (props) => {
	const [data, setData] = createSignal<ProfileView | undefined>();
	const [open, setOpen] = createSignal<boolean>(false);

	const value: MemberProfileContextValue = {
		data,
		setData,
		open,
		setOpen,
	};

	createEffect(() => {
		const isOpen = open();

		if (isOpen) return;

		setData(undefined);
	});

	return (
		<MemberProfileContext.Provider value={value}>
			{props.children}
		</MemberProfileContext.Provider>
	);
};

export const useMemberProfileContext = (): MemberProfileContextValue => {
	const ctx = useContext(MemberProfileContext);

	if (!ctx) {
		throw new Error("Unable to get member profile context.");
	}

	return ctx;
};
