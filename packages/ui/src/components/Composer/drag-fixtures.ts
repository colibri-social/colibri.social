export const fileTransfer = (...files: File[]) => {
	const transfer = new DataTransfer();
	for (const file of files) transfer.items.add(file);
	return transfer;
};

export const textTransfer = (text: string) => {
	const transfer = new DataTransfer();
	transfer.setData("text/plain", text);
	return transfer;
};

export const fireDrag = (
	target: Element,
	type: "dragenter" | "dragover" | "dragleave" | "drop" | "dragend",
	dataTransfer: DataTransfer,
) => {
	const event = new DragEvent(type, {
		bubbles: true,
		cancelable: true,
		dataTransfer,
	});
	target.dispatchEvent(event);
	return event;
};

export const storyFiles = () => [
	new File(["kingfisher"], "kingfisher.png", { type: "image/png" }),
	new File(["notes"], "crow-notes.pdf", { type: "application/pdf" }),
];
