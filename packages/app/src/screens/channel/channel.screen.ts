import { defineScreen } from "../../screen/define";
import { type ChannelArgs, channel } from "./channel.contract";

export default defineScreen<ChannelArgs>(channel, {
	mobile: () => import("./channel.mobile"),
	desktop: () => import("./channel.desktop"),
});
