const encoder = new TextEncoder();

export const utf8Length = (text: string) => encoder.encode(text).length;
