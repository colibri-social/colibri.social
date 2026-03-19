import {
	type Accessor,
	createContext,
	type ParentComponent,
	useContext,
} from "solid-js";
import type { MemberData } from "../layouts/CommunityLayout";
import type { SidebarData } from "@/utils/sdk";
import type { AccessorWithLatest } from "@solidjs/router";

export type CommunityContextData = {
	members: Accessor<Array<MemberData>>;
	owner: Accessor<string>;
	rkey: Accessor<string>;
	sidebar: AccessorWithLatest<SidebarData | null | undefined>;
};

export const CommunityContext = createContext<CommunityContextData>();

export const CommunityContextProvider: ParentComponent<CommunityContextData> = (
	props,
) => {
	const context: CommunityContextData = {
		members: props.members,
		owner: props.owner,
		rkey: props.rkey,
		sidebar: props.sidebar,
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
