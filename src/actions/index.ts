import { login } from "./auth/login";
import { createCategory } from "./category/create";
import { deleteCategory } from "./category/delete";
import { editCategory } from "./category/edit";
import { createChannel } from "./channel/create";
import { deleteChannel } from "./channel/delete";
import { editChannel } from "./channel/edit";
import { reorderChannels } from "./channel/reorder";
import { approveJoinRequest } from "./community/approve-join-request";
import { editCategoryOrder } from "./community/category-order";
import { createCommunity } from "./community/create";
import { deleteCommunity } from "./community/delete";
import { editCommunity } from "./community/edit";
import {
	createInviteCode,
	deleteInviteCode,
	listInviteCodes,
} from "./community/invite";
import { listPendingMembers } from "./community/members";
import { getEmbedDataForURI } from "./embeds/get";
import { blockMessage } from "./message/block";
import { deleteMessage } from "./message/delete";
import { editMessage } from "./message/edit";
import { postMessage } from "./message/post";
import { addReaction } from "./reactions/add";
import { removeReaction } from "./reactions/remove";
import { acceptInvitation } from "./user/accept-code";
import { setCommunityOrder } from "./user/community-order";
import { getUserProfileData } from "./user/get-profile-data";
import { leaveCommunity } from "./user/leave-community";
import { removeFromCommunityOrder } from "./user/remove-from-order";

export const server = {
	createCommunity,
	editCommunity,
	deleteCommunity,
	createCategory,
	editCategory,
	deleteCategory,
	createChannel,
	editChannel,
	deleteChannel,
	reorderChannels,
	postMessage,
	editMessage,
	deleteMessage,
	login,
	addReaction,
	removeReaction,
	setCommunityOrder,
	removeFromCommunityOrder,
	getEmbedDataForURI,
	editCategoryOrder,
	createInviteCode,
	deleteInviteCode,
	acceptInvitation,
	listInviteCodes,
	getUserProfileData,
	leaveCommunity,
	listPendingMembers,
	approveJoinRequest,
	blockMessage,
};
