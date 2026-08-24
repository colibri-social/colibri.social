export const isLegacyImmutable = (message: { legacy?: boolean }): boolean =>
	message.legacy === true;
