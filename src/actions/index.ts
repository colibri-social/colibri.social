import { login } from "./auth/login";
import { createCategory } from "./category/create";
import { createChannel } from "./channel/create";
import { createCommunity } from "./community/create";
import { deleteMessage } from "./message/delete";
import { editMessage } from "./message/edit";
import { postMessage } from "./message/post";
import { addReaction } from "./reactions/add";
import { removeReaction } from "./reactions/remove";

export const server = {
	createCommunity,
	createCategory,
	createChannel,
	postMessage,
	editMessage,
	deleteMessage,
	login,
	addReaction,
	removeReaction,
};
