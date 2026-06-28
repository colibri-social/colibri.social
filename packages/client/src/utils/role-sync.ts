import { useCommunityContext } from "../contexts/Community";
import { useUserContext } from "../contexts/User";

/**
 * Optimistic, debounced role toggling.
 *
 * @param opts.did Accessor for the DID of the member whose roles are managed
 *   (required for the default behavior.
 * @param opts.onToggle Custom click handler, invoked with the role URI.
 * @returns `memberRoles`/`hasRole` accessors and a `toggleRole` action.
 */
export const createRoleSync = (opts: {
	did?: () => string;
	onToggle?: (uri: string) => void;
}) => {
	const user = useUserContext();
	const community = useCommunityContext();

	const did = opts.did ?? (() => "");

	const memberRoles = () =>
		community().members.find((m) => m.did === did())?.roles ?? [];
	const hasRole = (uri: string) => memberRoles().includes(uri);

	let syncing = false;
	let pending = 0;

	const flush = async () => {
		if (syncing) return;
		syncing = true;
		let lastSent = -1;
		try {
			while (pending !== lastSent) {
				const gen = pending;
				const res = await user.xrpc.social.colibri.community.setMemberRoles(
					community().community.uri,
					did(),
					memberRoles(),
				);
				lastSent = gen;
				// The xrpc wrapper swallows errors and returns undefined; on failure
				// resync the authoritative state and stop.
				if (res === undefined) {
					community().utils.refetch();
					return;
				}
			}
		} finally {
			syncing = false;
			// A toggle may have slipped in during the final await/teardown.
			if (pending !== lastSent) void flush();
		}
	};

	const syncMemberRoles = (uri: string) => {
		const current = memberRoles();
		community().utils.setRolesForUser(
			did(),
			current.includes(uri)
				? current.filter((r) => r !== uri)
				: [...current, uri],
		);
		pending++;
		void flush();
	};

	return { memberRoles, hasRole, toggleRole: opts.onToggle ?? syncMemberRoles };
};
