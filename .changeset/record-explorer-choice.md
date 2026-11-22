---
"@colibri-social/app": minor
"@colibri-social/ui": minor
---

Add atproto.at as a second site for developer mode links. With developer mode on, Settings > Advanced shows an "Open records in" picker for PDSls or atproto.at, and the choice syncs across devices.

`@colibri-social/ui` adds `AtprotoAtLogo` and a record explorer module with `recordExplorerHref`, `setRecordExplorer`, `RecordExplorerLogo` and `showInExplorerLabel`. `recordExplorerHref` replaces `pdslsHrefFor`. The `pdslsHref`, `pdslsLabel` and `onShowOnPdsls` props are renamed to `explorerHref`, `explorerLabel` and `onShowInExplorer`, the `pdsls` settings entry is renamed to `recordExplorer`, and `AdvancedSettings` takes `recordExplorer`, `onRecordExplorerChange` and `platform`.
