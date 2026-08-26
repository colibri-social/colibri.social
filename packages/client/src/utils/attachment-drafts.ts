const drafts = new Map<string, File[]>();

export const readAttachmentDraft = (channelUri: string): File[] =>
	drafts.get(channelUri) ?? [];

export const writeAttachmentDraft = (
	channelUri: string,
	files: ReadonlyArray<File>,
): void => {
	if (files.length === 0) {
		drafts.delete(channelUri);
		return;
	}
	drafts.set(channelUri, [...files]);
};

export const clearAttachmentDraft = (channelUri: string): void => {
	drafts.delete(channelUri);
};
