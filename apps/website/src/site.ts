const COLIBRI_SITE = "https://colibri.social";

const SPACES_SITE = "https://spaces.colibri.social";

export const siteFor = (spaces: string | undefined) => {
	return spaces === "true" ? SPACES_SITE : COLIBRI_SITE;
};

export const NOINDEX = true;
