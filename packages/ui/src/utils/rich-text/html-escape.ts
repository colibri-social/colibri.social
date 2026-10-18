export const escapeHtml = (value: string): string =>
	value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const escapeAttr = (value: string): string =>
	escapeHtml(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
