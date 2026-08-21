import type { Component } from "solid-js";
import { useCommunityContext } from "../../../../contexts/Community";
import { useMessageContext } from "../../../../contexts/Message";
import { useUserContext } from "../../../../contexts/User";
import { useIsMobile } from "../../../../utils/mobile-pane";
import { facetsToProseMirror } from "../../common/text-editor/facets-to-prosemirror";
import { TextEditor } from "../../common/text-editor/TextEditor";

export const InlineEditor: Component = () => {
	const user = useUserContext();
	const community = useCommunityContext();
	const isMobile = useIsMobile();
	const messageCtx = useMessageContext();
	const { editedText, saveEditedText, submitEdits, cancelEdits } = messageCtx;

	return (
		<>
			<div class="w-full">
				<TextEditor
					text={facetsToProseMirror(
						editedText().text,
						editedText().facets || [],
						community().members || [],
						community().channels || [],
						community().assignableRoles || [],
						{
							communities: user.communities,
							categories: community().categories,
							currentCommunityUri: community().community.uri,
						},
					)}
					placeholder={
						messageCtx.message.text.length === 0 ? "Add a message" : ""
					}
					submitOnEnter={!isMobile()}
					onChange={(text, facets) => {
						saveEditedText(text, facets);
					}}
					sendMessage={async (text, facets) => {
						submitEdits(text, facets);
						return false;
					}}
					onEscape={cancelEdits}
				/>
			</div>
			<div class="flex flex-row items-center gap-1">
				<small>
					escape to{" "}
					<button
						type="button"
						class="cursor-pointer hover:underline text-primary-foreground"
						onClick={cancelEdits}
					>
						cancel
					</button>
				</small>
				<span class="w-1 h-1 bg-muted-foreground rounded-full" />
				<small>
					enter to{" "}
					<button
						type="button"
						class="cursor-pointer hover:underline text-primary-foreground"
						onClick={() => submitEdits(editedText().text, editedText().facets)}
					>
						submit
					</button>
				</small>
			</div>
		</>
	);
};
