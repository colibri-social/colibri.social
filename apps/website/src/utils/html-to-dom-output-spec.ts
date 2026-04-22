import type { DOMOutputSpec } from "prosemirror-model";

const defaultSpec: DOMOutputSpec = ["p", {}, ""];

const domParser = new window.DOMParser();

function namedNodeMapToRecord(attributes: NamedNodeMap) {
	const output: Record<string, string> = {};
	for (let i = 0; i < attributes.length; i++) {
		const attribute = attributes[i];
		output[attribute.name] = attribute.value;
	}
	return output;
}

/**
 * Convert an HTML string into ProseMirror's DOMOutputSpec,
 * but always wrap result in an Array for destructuring.
 *
 * https://gist.github.com/sampi/75ef0690b9ee9af27361b93d1681b49b
 */
export function htmlToDOMOutputSpec(html?: string | null) {
	if (html == null || html === "") {
		return [defaultSpec] as DOMOutputSpec[];
	}

	const collection = domParser
		.parseFromString(html, "text/html")
		.querySelectorAll("body")[0].childNodes;

	const convert = (nodes: NodeList) => {
		const output: any[] = [];

		if (nodes.length === 0) {
			return output;
		}

		for (let i = 0; i < nodes.length; i++) {
			const node = nodes[i];
			node.normalize();

			if (node.nodeType === window.Node.TEXT_NODE) {
				output.push(node.textContent);
			} else if (node.nodeType === window.Node.ELEMENT_NODE) {
				const attributes = (node as Element).attributes;
				output.push([
					node.nodeName.toLowerCase(),
					namedNodeMapToRecord(attributes),
					...convert(node.childNodes),
				]);
			}
		}
		return output;
	};

	return convert(collection) as unknown as DOMOutputSpec[];
}
