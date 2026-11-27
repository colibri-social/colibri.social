export const handlerWhen = <T>(enabled: unknown, handler: T): T | undefined => {
	return enabled ? handler : undefined;
};
