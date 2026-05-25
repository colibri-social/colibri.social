import { XrpcRequest } from "../../..";

export type RoleChannelOverride = {
	channel: string;
	allow: Array<string>;
	deny: Array<string>;
};

export type Role = {
	uri: string;
	name: string;
	color?: string;
	permissions: Array<string>;
	position: number;
	hoisted?: boolean;
	mentionable?: boolean;
	protected?: boolean;
	channelOverrides: Array<RoleChannelOverride>;
};

type Response = {
	roles: Array<Role>;
};

export const listRoles: XrpcRequest<
	[string],
	Promise<Response | undefined>
> = async (fetch, community) => {
	try {
		const res = await fetch(
			`/xrpc/social.colibri.community.listRoles?community=${community}`,
		);

		return res.json();
	} catch (err) {
		console.error(err);
		return undefined;
	}
};
