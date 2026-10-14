import type {
	CategoryPermissions,
	ChannelView,
	CommunityView,
	Did,
	RoleView,
} from "./types";

export const PERMISSION_FIELDS = [
	"ownerOnly",
	"allowedRoles",
	"allowedMembers",
	"visibleToRoles",
	"visibleToMembers",
] as const;

const restrictsReading = (value: CategoryPermissions) =>
	!!value.visibleToRoles?.length || !!value.visibleToMembers?.length;

const restrictsPosting = (value: CategoryPermissions) =>
	!!value.ownerOnly ||
	!!value.allowedRoles?.length ||
	!!value.allowedMembers?.length;

export const isPrivateCategory = restrictsReading;

export const permissionsOf = (
	value: CategoryPermissions,
): CategoryPermissions => ({
	ownerOnly: value.ownerOnly ?? false,
	allowedRoles: [...(value.allowedRoles ?? [])],
	allowedMembers: [...(value.allowedMembers ?? [])],
	visibleToRoles: [...(value.visibleToRoles ?? [])],
	visibleToMembers: [...(value.visibleToMembers ?? [])],
});

export const effectivePermissions = (
	channel: CategoryPermissions,
	category: CategoryPermissions | undefined,
): Required<CategoryPermissions> => {
	const own = permissionsOf(channel) as Required<CategoryPermissions>;
	if (!category) return own;
	const inherited = permissionsOf(category) as Required<CategoryPermissions>;
	const reading = restrictsReading(own) ? own : inherited;
	const posting = restrictsPosting(own) ? own : inherited;
	return {
		visibleToRoles: reading.visibleToRoles,
		visibleToMembers: reading.visibleToMembers,
		ownerOnly: posting.ownerOnly,
		allowedRoles: posting.allowedRoles,
		allowedMembers: posting.allowedMembers,
	};
};

export type ViewerAccess = {
	did: Did;
	community: CommunityView;
	roles: readonly RoleView[];
};

export const resolveChannelView = (
	channel: ChannelView,
	category: CategoryPermissions | undefined,
	viewer: ViewerAccess,
): ChannelView => {
	const effective = effectivePermissions(channel, category);
	const held = viewer.community.viewer.roles ?? [];
	const admin =
		!!viewer.community.viewer.isOwner ||
		viewer.roles.some((role) => role.protected && held.includes(role.rkey));
	const holds = (roles: readonly string[]) =>
		roles.some((rkey) => held.includes(rkey));
	const privateChannel =
		restrictsReading(effective) ||
		(channel.private === true && !restrictsReading(category ?? {}));
	const canRead =
		admin ||
		!privateChannel ||
		effective.visibleToMembers.includes(viewer.did) ||
		holds(effective.visibleToRoles);
	const openPosting =
		effective.allowedRoles.length === 0 &&
		effective.allowedMembers.length === 0;
	const canPost =
		canRead &&
		(admin ||
			(!effective.ownerOnly &&
				(openPosting ||
					effective.allowedMembers.includes(viewer.did) ||
					holds(effective.allowedRoles))));
	const view: ChannelView = {
		...channel,
		viewer: {
			...channel.viewer,
			canRead,
			canPost: canPost && channel.viewer.canPost !== false,
		},
	};
	if (privateChannel) view.private = true;
	else delete view.private;
	return view;
};
