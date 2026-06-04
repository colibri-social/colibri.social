import { useParams } from "@solidjs/router";

export const getCommunityParam = () => {
	const params = useParams();
	return params.community ?? "";
};

export const getChannelParam = () => {
	const params = useParams();
	return params.channel ?? "";
};
