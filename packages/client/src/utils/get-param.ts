import { useParams } from "@solidjs/router";

export const getCommunityParam = () => {
	const params = useParams();
	return params.community ?? "";
};
