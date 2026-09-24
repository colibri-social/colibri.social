import { colibri } from "../../../atproto/lexicons";
import type { LoggedInUser } from "../../../contexts/User";
import { classifyThrown } from "../../../errors/classify";
import { fetchDefaultCommunity } from "../../../utils/appview";
import { createLogger } from "../../../utils/logger";

const log = createLogger("default-community");

type JoiningUser = Pick<
	LoggedInUser,
	"communities" | "xrpc" | "refetchCommunities"
>;

export const joinDefaultCommunity = async (
	user: JoiningUser,
	readDefaultCommunity: () => Promise<
		string | undefined
	> = fetchDefaultCommunity,
): Promise<void> => {
	try {
		const community = await readDefaultCommunity();
		if (!community) return;
		if (user.communities.some((c) => c.did === community)) return;

		const res = await user.xrpc.call(
			colibri.community.join.main,
			{ body: { community } },
			{ expected: ["AlreadyMember", "Banned", "CommunityNotFound"] },
		);
		if (!res.ok) throw res.error;

		await user.refetchCommunities();
	} catch (err) {
		log.warn("could not join the default community", {
			code: classifyThrown(err, {
				method: "social.colibri.beta.community.join",
			}).code,
		});
	}
};
