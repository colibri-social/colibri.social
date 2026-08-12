import { isGoneCode } from "../errors/codes";
import { isColibriError } from "../errors/error";

export type CommunityExit = "stay" | "leave" | "gone";

export const decideCommunityExit = (
	loading: boolean,
	error: unknown,
	hasPayload: boolean,
): CommunityExit => {
	if (loading) return "stay";
	if (isColibriError(error) && isGoneCode(error.code)) return "gone";
	if (hasPayload) return "stay";
	if (isColibriError(error)) return "stay";
	return "leave";
};
