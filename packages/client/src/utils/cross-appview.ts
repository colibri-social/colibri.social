import { getAppViewDid } from "./appview";

export const isForeignHub = (hubDid: string | undefined): boolean =>
	hubDid !== undefined && hubDid !== "" && hubDid !== getAppViewDid();
