---
"@colibri-social/app": minor
"@colibri-social/ui": minor
---

Add a custom record explorer to developer mode. In Settings > Advanced, "Open records in" has a Custom choice that takes a link template with `{uri}`, `{uri:bare}`, `{authority}`, `{spaceType}`, `{spaceKey}`, `{repo}`, `{collection}` and `{rkey}` placeholders. In a Space, `{authority}` is the Space owner and `{repo}` is the author. The custom choice and its template stay on the device. A note under the picker links to the feedback board for suggesting more explorers.

`@colibri-social/ui` adds `RecordExplorerChoice`, `isRecordExplorerChoice`, `setCustomRecordExplorerTemplate`, `expandExplorerTemplate`, `explorerTemplateProblem`, `explorerTemplateHost` and `recordPartsOf`. `RECORD_EXPLORERS` is renamed to `RECORD_EXPLORER_LINKS` and holds names and link builders. `setRecordExplorer` accepts `"custom"`, and `AdvancedSettings` takes `customExplorerTemplate` and `onCustomExplorerTemplateSave`.
