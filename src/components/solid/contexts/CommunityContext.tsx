import { createContext, type ParentComponent, useContext } from "solid-js";
import type { MemberData } from "../layouts/CommunityLayout";

export type CommunityContextData = {
	members: () => Array<MemberData>;
};

export const CommunityContext = createContext<CommunityContextData>();

export const CommunityContextProvider: ParentComponent<{
	members: () => Array<MemberData>;
}> = (props) => {
	const context: CommunityContextData = {
		members: props.members,
	};

	return (
		<CommunityContext.Provider value={context}>
			{props.children}
		</CommunityContext.Provider>
	);
};

export const useCommunityContext = (): CommunityContextData | undefined => {
	return useContext(CommunityContext);
};
