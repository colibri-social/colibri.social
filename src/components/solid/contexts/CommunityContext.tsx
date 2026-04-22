import type { AccessorWithLatest } from "@solidjs/router";
import {
	type Accessor,
	createContext,
	type ParentComponent,
	useContext,
} from "solid-js";
import type { ChannelData, SidebarData } from "@/utils/sdk";
import type { MemberData } from "../layouts/CommunityLayout";

export type CommunityContextData = {
	members: Accessor<Array<MemberData>>;
	owner: Accessor<string>;
	rkey: Accessor<string>;
	channels: Accessor<Array<ChannelData>>;
	community: Accessor<string>;
	sidebar: AccessorWithLatest<SidebarData | null | undefined>;
	requiresApprovalToJoin: Accessor<boolean>;
};

export const CommunityContext = createContext<CommunityContextData>();

export const CommunityContextProvider: ParentComponent<CommunityContextData> = (
	props,
) => {
	const context: CommunityContextData = {
		members: props.members,
		owner: props.owner,
		rkey: props.rkey,
		channels: props.channels,
		community: props.community,
		sidebar: props.sidebar,
		requiresApprovalToJoin: props.requiresApprovalToJoin,
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
