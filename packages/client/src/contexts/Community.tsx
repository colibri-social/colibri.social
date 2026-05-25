import {
	Accessor,
	createContext,
	createMemo,
	createResource,
	Match,
	ParentComponent,
	Switch,
	useContext,
} from "solid-js";
import { AppLoadingScreen } from "../components/AppLoadingScreen";
import { urlSegmentToUri } from "../atproto/community-uri-to-url-compatible";
import { getCommunityParam } from "../utils/get-param";
import { Response as CommunityResponse } from "../atproto/xrpc/social/colibri/community/getData";
import { useUserContext } from "./User";

export const CommunityContext =
	createContext<Accessor<CommunityResponse>>();

export const CommunityContextProvider: ParentComponent = (props) => {
	const user = useUserContext();
	const communityUri = createMemo(() => urlSegmentToUri(getCommunityParam()));

	const [community] = createResource(
		communityUri,
		async (uri) => {
			return await user.xrpc.social.colibri.community.getData(uri);
		},
	);

	// `community.latest` holds the most recently resolved value, even while a
	// new fetch is in flight. By reading from `latest` (rather than the resource
	// accessor itself), the previous community stays visible during navigation
	// instead of being replaced by the loading screen.
	const value: Accessor<CommunityResponse> = () =>
		community.latest as CommunityResponse;

	// TODO: Handle updates for member list, maybe update resource?

	return (
		<Switch>
			<Match when={community.error}>
				<span>{`${community.error}`}</span>
			</Match>
			<Match when={community.loading && !community.latest}>
				<AppLoadingScreen message="Fetching community details..." />
			</Match>
			<Match when={community.latest}>
				<CommunityContext.Provider value={value}>
					{props.children}
				</CommunityContext.Provider>
			</Match>
		</Switch>
	);
};

export const useCommunityContext = (): Accessor<CommunityResponse> => {
	const ctx = useContext(CommunityContext);

	if (!ctx) {
		throw new Error("Unable to get community context.");
	}

	return ctx;
};
