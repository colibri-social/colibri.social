export const parseZodToErrorOrDisplay = (message: string) => {
	if (message.includes("Failed to validate:")) {
		const obj = JSON.parse(message.replace("Failed to validate:", ""));

		return obj[0].message;
	}

	return message;
};
