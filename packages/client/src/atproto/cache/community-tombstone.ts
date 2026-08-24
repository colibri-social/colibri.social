const gone = new Set<string>();
const deleting = new Set<string>();

export const markCommunityDeleting = (key: string): void => {
	deleting.add(key);
};

export const clearCommunityDeleting = (key: string): void => {
	deleting.delete(key);
};

export const tombstoneCommunity = (key: string): void => {
	deleting.delete(key);
	gone.add(key);
};

export const isCommunityGone = (key: string): boolean => gone.has(key);

export const isCommunityInert = (key: string): boolean =>
	gone.has(key) || deleting.has(key);
