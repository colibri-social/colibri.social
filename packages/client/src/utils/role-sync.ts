import { colibri } from "../atproto/lexicons";
import { clientForManagingApp } from "../atproto/xrpc";
import { useCommunityContext } from "../contexts/Community";
import { useUserContext } from "../contexts/User";

export const createRoleSync = (opts: {
	did?: () => string;
	onToggle?: (rkey: string) => void;
}) => {
	const user = useUserContext();
	const community = useCommunityContext();

	const did = opts.did ?? (() => "");

	const memberRoles = () =>
		community().members.find((m) => m.did === did())?.roles ?? [];
	const hasRole = (rkey: string) => memberRoles().includes(rkey);

	let syncing = false;
	let pending = 0;

	const flush = async () => {
		if (syncing) return;
		syncing = true;
		let lastSent = -1;
		try {
			while (pending !== lastSent) {
				const gen = pending;
				const client = clientForManagingApp(
					user.atproto.agent,
					community().community.managingApp,
				);
				const res = await client.call(colibri.community.setMemberRoles.main, {
					body: {
						community: community().community.did,
						subject: did(),
						roles: memberRoles(),
					},
				});
				lastSent = gen;
				if (!res.ok) {
					community().utils.refetch();
					return;
				}
			}
		} finally {
			syncing = false;
			if (pending !== lastSent) void flush();
		}
	};

	const syncMemberRoles = (rkey: string) => {
		const current = memberRoles();
		community().utils.setRolesForUser(
			did(),
			current.includes(rkey)
				? current.filter((r) => r !== rkey)
				: [...current, rkey],
		);
		pending++;
		void flush();
	};

	return { memberRoles, hasRole, toggleRole: opts.onToggle ?? syncMemberRoles };
};
